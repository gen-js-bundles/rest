var
  inquirer = require("inquirer"),
  chalk = require('chalk'),
  Q = require('q'),
  fs = require('fs'),
  path = require('path'),
  gfile = require('gfilesync'),
  mkdirp = require('mkdirp'),
  yaml = require('js-yaml'),
  GenJS = require('genjs');

var Task = (function() {
  function Task() {
  }
  Task.prototype.do = function(data, callback) {
    this.doMain(data, callback);
  };
  Task.prototype.getEntities = function() {
    var entities = {};
    for(var entityId in this.genJS.entities) {
      var entity = this.genJS.entities[entityId];
      if(this.hasTagDomain(entity)) {
        entities[entityId] = entity;
      }
    }
    return entities;
  };
  Task.prototype.hasTagDomain = function(entity) {
    for(var tagId in entity.tags) {
      if(tagId == 'rest') {
        if(entity.tags != null && entity.tags.rest != null && entity.tags.rest.paths != null) {
          return true;
        }
      }
    }
    return false;
  };
  Task.prototype.loadGenJS = function(data) {
    this.genJS = new GenJS(data.Genjsfile);
    this.genJS.load();
  };
  Task.prototype.showAPI = function() {
    console.log('=> API:');
    var entities = this.getEntities();
    for(var entityId in entities) {
      var entity = entities[entityId];
      this.showOneEntity(entity);
    }
    console.log('');
  };
  Task.prototype.showEntity = function(entity) {
    this.showOneEntity(entity);
    console.log('');
  };
  Task.prototype.showOneEntity = function(entity) {
    console.log('');
    console.log(chalk.red.bold(entity.id));
    var hasPath = false;
    for(var pathId in entity.tags.rest.paths) {
      hasPath = true;
      var path = entity.tags.rest.paths[pathId];
      path.id = pathId;
      this.showOnePath(path);
    }
    if(!hasPath) {
      console.log('  < no path >');
    }
  };
  Task.prototype.showPath = function(path, entity) {
    console.log('');
    console.log(chalk.red.bold(entity.id));
    this.showOnePath(path);
    console.log('');
  };
  Task.prototype.showOnePath = function(path) {
    console.log(chalk.blue('  '+path.id));

    for(var methodId in path.methods) {
      var method = path.methods[methodId];
      method.id = methodId;
      this.showOneMethod(method);
    }
  };
  Task.prototype.showMethod = function(method, path, entity) {
    console.log('');
    console.log(chalk.red.bold(entity.id));
    console.log(chalk.blue('  '+path.id));
    this.showOneMethod(method);
    console.log('');
  };
  Task.prototype.showOneMethod = function(method) {
    console.log(chalk.blue('    '+method.id));
    if(method.name != null) {
      console.log('      name', ':', chalk.magenta(method.name));
    }
    if(method.params != null) {
      console.log('      parameters', ':');
      for(var paramId in method.params) {
        var param = method.params[paramId];
        console.log(chalk.blue('        '+paramId),':',chalk.magenta(param.type));
      }
    }
    if(method.return != null) {
      console.log('      return', ':', chalk.magenta(method.return));
    }
  };
  Task.prototype.cleanEntity = function(entity) {
    var entityClean = {};
    for(var eltId in entity) {
      if(eltId != 'id' && eltId != 'fields' && eltId != 'paths' && eltId != 'links') {
        entityClean[eltId] = entity[eltId];
      }
    }
    if(entity.tags.rest.paths != null) {
      entityClean.paths = {};
      for (var pathId in entity.tags.rest.paths) {
        var path = entity.tags.rest.paths[pathId];
        var pathClean = {};
        entityClean.tags.rest.paths[pathId] = pathClean;
        for(var eltId in path) {
          if(eltId != 'id' && eltId != 'methods') {
            pathClean[eltId] = path[eltId];
          }
          if(path.methods != null) {
            var methods = path.methods;
            pathClean.methods = {};
            for(var methodId in path.methods) {
              var method = path.methods[methodId];
              var methodClean = {};
              pathClean.methods[methodId] = methodClean;
              for(var eltMethod in method) {
                if(eltMethod != 'id') {
                  methodClean[eltMethod] = method[eltMethod];
                }
              }
            }
          }
        }
      }
    }
    return entityClean;
  };
  Task.prototype.writeEntity = function(entity) {
    var entityToSave = this.cleanEntity(entity);
    var modelDir = this.genJS.modelDirs[0];
    mkdirp.sync(path.join(modelDir));
    gfile.writeYaml(path.join(modelDir,entity.id+'.yml'), entityToSave);
  };
  Task.prototype.deleteEntity = function(entity) {
    var modelDir = this.genJS.modelDirs[0];
    fs.unlinkSync(path.join(modelDir,entity.id+'.yml'));
  };
  Task.prototype.doMain = function(data, callback) {
    this.loadGenJS(data);
    this.showAPI();
    var choices = [];
    var entities = this.getEntities();
    choices.push({
      name: 'Exit',
      value: null
    });
    choices.push(new inquirer.Separator());
    choices.push({
      name: 'Add entity',
      value: 'add'
    });
    if(entities != null && Object.keys(entities).length > 0) {
      choices.push({
        name: 'Remove entity',
        value: 'remove'
      });
      choices.push(new inquirer.Separator());
      var entities = this.getEntities();
      for (var entityId in entities) {
        var entity = entities[entityId];
        choices.push({
          value: entity,
          name: entity.name,
          checked: false
        });
      }
    }
    var questions = [
      {
        type: 'list',
        name: 'action',
        message: 'Action',
        choices: choices
      }
    ];
    inquirer.prompt(questions, function( answers ) {
      if(answers.action == 'add') {
        this.doAddEntity(data, function (entity) {
          if(entity == null) {
            this.doMain(data, callback);
          } else {
            this.doEditEntity(entity, data, function () {
              this.doMain(data, callback);
            }.bind(this));
          }
        }.bind(this));
      }
      else if(answers.action == 'remove') {
        this.doSelectEntity(data, function (entity) {
          if(entity == null) {
            this.doMain(data, callback);
          } else {
            this.doRemoveEntity(entity, data, function () {
              this.doMain(data, callback);
            }.bind(this))
          }
        }.bind(this));
      }
      else if(answers.action != null) {
        var entity = answers.action;
        this.doEditEntity(entity, data, function () {
          this.doMain(data, callback);
        }.bind(this));
      }
      if(callback) {
        callback();
      }
    }.bind(this));
  };
  Task.prototype.doAddEntity = function(data, callback) {
    var questions = [
      {
        type: 'input',
        name: 'entityName',
        message: 'Entity name'
      }
    ];
    inquirer.prompt(questions, function( answers ) {
      console.log(answers.entityName);
      if(answers.entityName == null || answers.entityName == '') {
        callback(null);
      } else {
        var entity = {
          id: answers.entityName,
          name: answers.entityName,
          tags: {
            rest: {
              paths: {

              }
            }
          }
        };
        this.writeEntity(entity);
        this.loadGenJS(data);
        callback(entity);
      }
    }.bind(this));
  };
  Task.prototype.doSelectEntity = function(data, callback) {
    var entitiesChoices = [];
    entitiesChoices.push({
      name: 'Exit',
      value: null
    });
    entitiesChoices.push(new inquirer.Separator());
    var entities = this.getEntities();
    for (var entityId in entities) {
      var entity = entities[entityId];
      entitiesChoices.push({
        value: entity,
        name: entity.name,
        checked: false
      });
    }
    var questions = [
      {
        type: 'list',
        name: 'entity',
        message: 'Entity',
        choices: entitiesChoices
      }
    ];
    inquirer.prompt(questions, function( answers ) {
      callback(answers.entity);
    }.bind(this));
  };
  Task.prototype.doRemoveEntity = function(entity, data, callback) {
    if(entity == null) {
      callback();
      return;
    }
    var questions = [
      {
        type: 'confirm',
        name: 'confirm',
        message: 'Confirm remove entity: '+entity.id,
        default: true
      }
    ];
    inquirer.prompt(questions, function( answers ) {
      if(answers.confirm) {
        this.deleteEntity(entity);
      }
      callback();
    }.bind(this));
  };

  Task.prototype.doEditEntity = function(entity, data, callback) {
    if(entity == null) {
      callback();
      return;
    }
    this.loadGenJS(data);
    var entities = this.getEntities();
    entity = entities[entity.id];
    this.showEntity(entity);
    var choices = [];
    choices.push({
      name: 'Exit',
      value: ''
    });
    choices.push(new inquirer.Separator());
    choices.push({
      name: 'Add path',
      value: 'addPath'
    });
    if(entity.tags.rest.paths != null && Object.keys(entity.tags.rest.paths).length > 0) {
      choices.push({
        name: 'Remove path',
        value: 'removePath'
      });
      choices.push(new inquirer.Separator());
      for (var pathId in entity.tags.rest.paths) {
        var path = entity.tags.rest.paths[pathId];
        path.id = pathId;
        choices.push({
          value: path,
          name: pathId,
          checked: false
        });
      }
    }

    var questions = [
      {
        type: 'list',
        name: 'action',
        message: 'Action on the entity : '+entity.id,
        choices: choices
      }
    ];
    inquirer.prompt(questions, function( answers ) {
      if(answers.action == 'addPath') {
        this.doAddPath(entity, data, function() {
          if(path == null) {
            this.doEditEntity(entity, data, callback);
          } else {
            this.doEditPath(path, entity, data, function () {
              this.doEditEntity(entity, data, callback);
            }.bind(this));
          }
        }.bind(this));
      }
      else if(answers.action == 'removePath') {
        this.doSelectPath(entity, data, function(path) {
          if(path == null) {
            this.doEditEntity(entity, data, callback);
          } else {
            this.doRemovePath(path, entity, data, function () {
              this.doEditEntity(entity, data, callback);
            }.bind(this))
          }
        }.bind(this));
      }
      else if(answers.action != '') {
        var path = answers.action;
        this.doEditPath(path, entity, data, function () {
          this.doEditEntity(entity, data, callback);
        }.bind(this));
      }
      if(answers.action == '') {
        if(callback) {
          callback();
        }
      }
    }.bind(this));
  };

  Task.prototype.doSelectPath = function(entity, data, callback) {
    if(entity == null) {
      callback();
      return;
    }
    var pathsChoices = [];
    pathsChoices.push({
      name: 'Exit',
      value: null
    });
    pathsChoices.push(new inquirer.Separator());
    for (var pathId in entity.tags.rest.paths) {
      var path = entity.tags.rest.paths[pathId];
      path.id = pathId;
      pathsChoices.push({
        value: path,
        name: pathId,
        checked: false
      });
    }
    var questions = [
      {
        type: 'list',
        name: 'path',
        message: 'Path',
        choices: pathsChoices
      }
    ];
    inquirer.prompt(questions, function( answers ) {
      callback(answers.path);
    }.bind(this));
  };

  Task.prototype.doAddPath = function(entity, data, callback) {
    if(entity == null) {
      callback();
      return;
    }
    var questions = [
      {
        type: 'input',
        name: 'id',
        message: 'Path name'
      }
    ];
    inquirer.prompt(questions, function( answers ) {
      if(answers.name == '') {
        callback(null);
      } else {
        var path = {
          id: answers.id
        };
        entity.tags.rest.paths[answers.id] = path;
        this.writeEntity(entity);
        callback(path);
      }
    }.bind(this));
  };

  Task.prototype.doRemovePath = function(path, entity, data, callback) {
    if(path == null) {
      callback();
      return;
    }
    var questions = [
      {
        type: 'confirm',
        name: 'confirm',
        message: 'Confirm remove path: '+entity.id+'.'+path.id,
        default: true
      }
    ];
    inquirer.prompt(questions, function( answers ) {
      if(answers.confirm) {
        delete entity.tags.rest.paths[path.id];
        this.writeEntity(entity);
      }
      callback();
    }.bind(this));
  };

  Task.prototype.doEditPath = function(path, entity, data, callback) {
    if(path == null) {
      callback();
      return;
    }
    this.loadGenJS(data);
    var entities = this.getEntities();
    entity = entities[entity.id];
    var pathId = path.id;
    path = entity.tags.rest.paths[path.id];
    path.id = pathId;
    this.showPath(path, entity);
    var choices = [];
    choices.push({
      name: 'Exit',
      value: ''
    });
    choices.push(new inquirer.Separator());
    choices.push({
      name: 'Add method',
      value: 'addMethod'
    });
    if(path.methods != null && Object.keys(path.methods).length > 0) {
      choices.push({
        name: 'Remove method',
        value: 'removeMethod'
      });
      choices.push(new inquirer.Separator());
      for (var methodId in path.methods) {
        var method = path.methods[methodId];
        method.id = methodId;
        choices.push({
          value: method,
          name: methodId,
          checked: false
        });
      }
    }
    choices.push(new inquirer.Separator());
    choices.push({
      name: 'Add path',
      value: 'addPath'
    });
    if(path.paths != null && Object.keys(path.paths).length > 0) {
      choices.push({
        name: 'Remove path',
        value: 'removePath'
      });
      choices.push(new inquirer.Separator());
      for (var path2Id in path.paths) {
        var path2 = path.paths[pathId];
        path2.id = path2Id;
        choices.push({
          value: path2,
          name: path2Id,
          checked: false
        });
      }
    }

    var questions = [
      {
        type: 'list',
        name: 'action',
        message: 'Action on the path : '+path.id,
        choices: choices
      }
    ];
    inquirer.prompt(questions, function( answers ) {
      if(answers.action == 'addMethod') {
        this.doAddMethod(path, entity, data, function(method) {
          if(method == null) {
            this.doEditPath(path, entity, data, callback);
          } else {
            this.doEditMethod(method, path, entity, data, function () {
              this.doEditPath(path, entity, data, callback);
            }.bind(this))
          }
        }.bind(this));
      }
      else if(answers.action == 'removeMethod') {
        this.doSelectMethod(path, entity, data, function(method) {
          if(method == null) {
            this.doEditPath(path, entity, data, callback);
          } else {
            this.doRemoveMethod(method, path, entity, data, function () {
              this.doEditPath(path, entity, data, callback);
            }.bind(this))
          }
        }.bind(this));
      }
      else if(answers.action == 'addPath') {
        this.doAddPath(entity, data, function() {
          if(path == null) {
            this.doEditEntity(entity, data, callback);
          } else {
            this.doEditPath(path2, entity, data, function () {
              this.doEditEntity(entity, data, callback);
            }.bind(this));
          }
        }.bind(this));
      }
      else if(answers.action == 'removePath') {
        this.doSelectPath(entity, data, function(path) {
          if(path == null) {
            this.doEditEntity(entity, data, callback);
          } else {
            this.doRemovePath(path2, entity, data, function () {
              this.doEditEntity(entity, data, callback);
            }.bind(this))
          }
        }.bind(this));
      }
      else if(answers.action != '') {
        var method = answers.action;
        this.doEditMethod(method, path, entity, data, function () {
          this.doEditPath(path, entity, data, callback);
        }.bind(this));
      }
      if(answers.action == '') {
        if(callback) {
          callback();
        }
      }
    }.bind(this));
  };
  Task.prototype.doSelectMethod = function(path, entity, data, callback) {
    if(path == null) {
      callback();
      return;
    }
    var methodsChoices = [];
    methodsChoices.push({
      name: 'Exit',
      value: null
    });
    methodsChoices.push(new inquirer.Separator());
    for (var methodId in path.methods) {
      var method = path.methods[methodId];
      method.id = methodId;
      methodsChoices.push({
        value: method,
        name: methodId,
        checked: false
      });
    }
    var questions = [
      {
        type: 'list',
        name: 'method',
        message: 'Method',
        choices: methodsChoices
      }
    ];
    inquirer.prompt(questions, function( answers ) {
      callback(answers.method);
    }.bind(this));
  };

  Task.prototype.doAddMethod = function(path, entity, data, callback) {
    if(path == null) {
      callback();
      return;
    }
    var methodChoices = [];
    var methods = {
      'GET': true,
      'POST': true,
      'PUT': true,
      'DELETE': true,
      'PATCH': true,
      'OPTIONS': true
    };
    for(var method in path.methods) {
      methods[method] = false;
    }
    for(var method in methods) {
      if(methods[method]) {
        methodChoices.push({
          name: method,
          value: method
        });
      }
    }
    var questions = [
      {
        type: 'list',
        name: 'id',
        message: 'Method HTTP',
        choices: methodChoices
      }
    ];
    inquirer.prompt(questions, function( answers ) {
      if(answers.name == '') {
        callback(null);
      } else {
        var method = {
          id: answers.id
        };
        if(path.methods == null) {
          path.methods = {};
        }
        path.methods[answers.id] = method;
        this.writeEntity(entity);
        var method = entity.tags.rest.paths[path.id].methods[method.id];
        callback(method);
      }
    }.bind(this));
  };

  Task.prototype.doEditMethod = function(method, path, entity, data, callback) {
    if(path == null) {
      callback();
      return;
    }
    this.showMethod(method, path, entity);
    var questions = [
      {
        type: 'input',
        name: 'name',
        message: 'Method name',
        default: function() {
          if(method.name != null) {
            return method.name;
          }
          var pathName = path.id;
          while(pathName.indexOf('/') != -1) {
            var pos = pathName.indexOf('/');
            pathName = pathName.substring(0,pos) + pathName.charAt(pos+1).toUpperCase() + pathName.substring(pos+2);
          }
          if(pathName.lastIndexOf('s') == pathName.length-1) {
            if(method.id == 'GET') {
              return 'getAll'+pathName;
            }
          } else {
            if(method.id == 'GET') {
              return 'getOne'+pathName;
            }
          }
        }
      },
      {
        type: 'input',
        name: 'return',
        message: 'Method return',
        default: function() {
          if(method.return != null) {
            return method.return;
          } else {
            var pathName = path.id;
            var pos = pathName.lastIndexOf('/');
            pathName = pathName.charAt(pos+1).toUpperCase() + pathName.substring(pos+2);
            if(path.id.lastIndexOf('s') == path.id.length-1) {
              pathName = pathName.substring(0,pathName.length-1);
              if(method.id == 'GET') {
                return 'List<'+pathName+'>';
              }
            } else {
              if(method.id == 'GET') {
                return pathName;
              }
            }
          }
        }
      }
    ];
    inquirer.prompt(questions, function( answers ) {
      if(answers.name == '') {
        callback(null);
      } else {
        method.name = answers.name;

        var paramInquirer = (function paramInquirer(method) {

          var parameterChoices = [];
          for(var paramId in method.params) {
            var param = method.params[paramId];
            param.id = paramId;
            parameterChoices.push({
              name: param.id + ' : ' + param.type,
              value: param
            })
          }

          var parameterActionChoices = [];
          parameterActionChoices.push({
            name: 'Exit',
            value: null
          });
          parameterActionChoices.push(new inquirer.Separator());
          parameterActionChoices.push(
            {
              name: 'Add parameter',
              value: 'add'
            }
          );
          if(parameterChoices.length > 0) {
            parameterActionChoices.push({
                name: 'Remove parameter',
                value: 'remove'
              });
            parameterActionChoices.push(new inquirer.Separator());
            for(var i=0; i<parameterChoices.length; i++) {
              parameterActionChoices.push(parameterChoices[i]);
            }
          }

          var parameterRemoveChoices = [];
          parameterRemoveChoices.push({
            name: 'Exit',
            value: null
          });
          parameterRemoveChoices.push(new inquirer.Separator());
          if(parameterChoices.length > 0) {
            for(var i=0; i<parameterChoices.length; i++) {
              parameterRemoveChoices.push(parameterChoices[i]);
            }
          }
          var questions = [
            {
              type: 'list',
              name: 'paramAction',
              message: 'Parameter action',
              choices: parameterActionChoices
            },
            {
              type: 'list',
              name: 'paramToRemove',
              message: 'Parameter to remove',
              when: function(answers) {
                return answers.paramAction == 'remove';
              },
              choices: parameterRemoveChoices
            },
            {
              type: 'input',
              name: 'paramName',
              message: 'Parameter name',
              when: function(answers) {
                return answers.paramAction != null && answers.paramAction !== 'remove';
              },
              default: function(answers) {
                if(answers.paramAction !== 'add') {
                  return answers.paramAction.name;
                };
              }
            },
            {
              type: 'input',
              name: 'paramType',
              message: 'Parameter type',
              when: function(answers) {
                return answers.paramAction != null && answers.paramAction !== 'remove' && answers.paramName != '';
              },
              default: function(answers) {
                if(answers.paramAction !== 'add') {
                  return answers.paramAction.name;
                };
              }
            }
          ];
          var deferred = Q.defer();
          inquirer.prompt(questions, function (answers) {
            if(answers.paramAction != null && answers.paramName != '') {
              if(answers.paramAction == 'remove') {
                delete method.params[answers.paramToRemove.id];
              }
              else {
                if(answers.paramAction == 'add') {
                  if (method.params == null) {
                    method.params = {};
                  }
                  var param = {
                    id: answers.paramName
                  };
                  method.params[answers.paramName] = param;
                }
                else { // action : modify
                  var paramName = answers.paramAction.id;
                  console.log(paramName);
                  var param = method.params[paramName];
                  if(paramName != answers.paramName) {
                    delete method.params[paramName];
                    method.params[answers.paramName] = param;
                    param.id = answers.paramName;
                  }
                }
                param.type = answers.paramType;
              }
              paramInquirer(method)
                .then(function() {
                  deferred.resolve();
                });
            } else {
              deferred.resolve();
            }
          });
          return deferred.promise;
        });
        paramInquirer(method)
          .then(function() {
            method.return = answers.return;
            this.writeEntity(entity);
            callback();
          }.bind(this));
      }
    }.bind(this));
  };

  Task.prototype.doRemoveMethod = function(method, path, entity, data, callback) {
    if(method == null) {
      callback();
      return;
    }
    var questions = [
      {
        type: 'confirm',
        name: 'confirm',
        message: 'Confirm remove method: '+path.id+'.'+method.id,
        default: true
      }
    ];
    inquirer.prompt(questions, function( answers ) {
      if(answers.confirm) {
        delete path.methods[method.id];
        this.writeEntity(entity);
      }
      callback();
    }.bind(this));
  };

  return Task;
})();

module.exports = new Task();