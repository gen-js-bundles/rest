/*
 * JBoss, Home of Professional Open Source
 * Copyright 2013, Red Hat, Inc. and/or its affiliates, and individual
 * contributors by the @authors tag. See the copyright.txt in the
 * distribution for a full listing of individual contributors.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 * http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
package <%=gen.package%>;

import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.logging.Logger;

import javax.enterprise.context.RequestScoped;
import javax.inject.Inject;
import javax.persistence.NoResultException;
import javax.validation.ConstraintViolation;
import javax.validation.ConstraintViolationException;
import javax.validation.ValidationException;
import javax.validation.Validator;
import javax.ws.rs.Consumes;
import javax.ws.rs.GET;
import javax.ws.rs.POST;
import javax.ws.rs.Path;
import javax.ws.rs.PathParam;
import javax.ws.rs.Produces;
import javax.ws.rs.WebApplicationException;
import javax.ws.rs.core.MediaType;
import javax.ws.rs.core.Response;

import <%=project.package%>.data.MemberRepository;
import <%=project.package%>.model.Member;
import <%=project.package%>.service.MemberRegistration;

/**
 * JAX-RS Example
 * <p/>
 * This class produces a RESTful service to read/write the contents of the members table.
 */
@RequestScoped
public class <%=gen.name%> {

    @Inject
    private Logger log;

    @Inject
    private Validator validator;

    @Inject
    private MemberRepository repository;

    @Inject
    MemberRegistration registration;
    
<%
each(current.tags.rest.paths, function(path, pathUri) {
  each(path.methods, function(method, methodHttp) {
    var paramsStr = "";
    var first = true;
    each(method.params, function(param, paramName) {
      if(first) {first = false;} else {paramsStr += ', ';}
      if(param.pathParam) {
        paramsStr += '@PathParam';
        if(param.pathParam.name != null) {
          if(!hasArg) {hasArg=true;} else {paramsStr += ', ';}
          paramsStr += '("'+param.pathParam.name+'") ';
        }
      }
      if(param.requestParam) {
        var hasArg = false;
        paramsStr += '@RequestParam(';
        if(param.requestParam.value != null) {
          if(!hasArg) {hasArg=true;} else {paramsStr += ', ';}
          paramsStr += 'value="'+param.requestParam.value+'"';
        }
        if(param.requestParam.required != null) {
            if(!hasArg) {hasArg=true;} else {paramsStr += ', ';}
            paramsStr += 'required='+param.requestParam.required;
        }
        if(param.requestParam.defaultValue != null) {
            if(!hasArg) {hasArg=true;} else {paramsStr += ', ';}
            paramsStr += 'defaultValue="'+param.requestParam.defaultValue+'"';
        }
        paramsStr += ') ';
      }
      paramsStr += param.type + ' ' + paramName;
    });

    if(method.return == null) {
        var methodReturn = 'void';
    } else{
        var methodReturn = method.return;
    }
%>
	@<%=methodHttp.toUpperCase()%>
    @Path("<%=pathUri%>")
    @Produces(MediaType.APPLICATION_JSON)
    public <%=methodReturn%> <%=method.name%>(<%=paramsStr%>) { // <[<%=method.name%>:
        <% if(method.return == 'String') { %>
        return "<%=method.name%>";
        <% } %>
    } // ]>


<%})
})%>
    
    /**
     * <p>
     * Validates the given Member variable and throws validation exceptions based on the type of error. If the error is standard
     * bean validation errors then it will throw a ConstraintValidationException with the set of the constraints violated.
     * </p>
     * <p>
     * If the error is caused because an existing member with the same email is registered it throws a regular validation
     * exception so that it can be interpreted separately.
     * </p>
     * 
     * @param member Member to be validated
     * @throws ConstraintViolationException If Bean Validation errors exist
     * @throws ValidationException If member with the same email already exists
     */
    private void validateMember(Member member) throws ConstraintViolationException, ValidationException {
        // Create a bean validator and check for issues.
        Set<ConstraintViolation<Member>> violations = validator.validate(member);

        if (!violations.isEmpty()) {
            throw new ConstraintViolationException(new HashSet<ConstraintViolation<?>>(violations));
        }

        // Check the uniqueness of the email address
        if (emailAlreadyExists(member.getEmail())) {
            throw new ValidationException("Unique Email Violation");
        }
    }

    /**
     * Creates a JAX-RS "Bad Request" response including a map of all violation fields, and their message. This can then be used
     * by clients to show violations.
     * 
     * @param violations A set of violations that needs to be reported
     * @return JAX-RS response containing all violations
     */
    private Response.ResponseBuilder createViolationResponse(Set<ConstraintViolation<?>> violations) {
        log.fine("Validation completed. violations found: " + violations.size());

        Map<String, String> responseObj = new HashMap<>();

        for (ConstraintViolation<?> violation : violations) {
            responseObj.put(violation.getPropertyPath().toString(), violation.getMessage());
        }

        return Response.status(Response.Status.BAD_REQUEST).entity(responseObj);
    }

    /**
     * Checks if a member with the same email address is already registered. This is the only way to easily capture the
     * "@UniqueConstraint(columnNames = "email")" constraint from the Member class.
     * 
     * @param email The email to check
     * @return True if the email already exists, and false otherwise
     */
    public boolean emailAlreadyExists(String email) {
        Member member = null;
        try {
            member = repository.findByEmail(email);
        } catch (NoResultException e) {
            // ignore
        }
        return member != null;
    }
}
