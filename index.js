"use strict";

var connect = require("connect"),
    browseridVerify = require("browserid-verify");

var defaultOptions = {
  audience: "",
  logoutPath: "/persona/logout",
  sessionKey: "email",
  verifierURI: "https://verifier.login.persona.org/verify",
  verifyPath: "/persona/verify",
  verifyResponse: function(error, req, res, email) {
    var out;
    if (error) {
      out = { status: "failure", reason: error };
      res.status(500);
    } else {
      out = { status: "okay", email: email };
    }
    res.json(out);
  },
  logoutResponse: function(error, req, res) {
    var out;
    if (error) {
      out = { status: "failure", reason: error };
    } else {
      out = { status: "okay" };
    }
    res.json(out);
  },
  middleware: function(req, res, next) {
    next();
  }
};

module.exports = function(app, options) {
  options = options || {};

  var personaOpts = {};
  Object.keys(defaultOptions).forEach(function(key) {
    if (typeof options[key] != "undefined") {
      personaOpts[key] = options[key];
    } else {
      personaOpts[key] = defaultOptions[key];
    }
  });

  var verify = browseridVerify({
    url: personaOpts.verifierURI
  });

  app.post(personaOpts.verifyPath, connect.json(), connect.urlencoded(), personaOpts.middleware, function(req, res) {
    // If the body can't be parsed then we can't get the assertion
    if (!req.body) {
      personaOpts.verifyResponse("Server-side exception", req, res);
      return;
    }
    console.log(personaOpts.audience, req.body.audience)
    
    if(typeof personaOpts.audience == 'string') {
      var audience = personaOpts.audience;  
    }else{
      var audience = personaOpts.audience.slice(personaOpts.audience.indexOf(req.body.audience))[0]
    }

    verify(req.body.assertion, audience, function(err, email, response) {
      if (err) {
        if (err instanceof Error) {
          err = err.message;
        }
        return personaOpts.verifyResponse(err, req, res);
      }

      if (response && response.status !== "okay") {
        return personaOpts.verifyResponse(response.reason, req, res, email);
      }

      if (req.session) {
        req.session[personaOpts.sessionKey] = email;
      }

      personaOpts.verifyResponse(null, req, res, email);
    });
  });

  app.post(personaOpts.logoutPath, personaOpts.middleware, function(req, res) {
    if (req.session) {
      req.session[personaOpts.sessionKey] = null;
    }

    personaOpts.logoutResponse(null, req, res);
  });
};
