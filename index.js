const http = require("http")
const https = require("https")
const url = require("url")
const os = require("os")

class Wrapper {
  constructor(wrapperValue) {
    this.value = function() {
      if(wrapperValue.constructor.name == "Array") { return wrapperValue.map(item => item); }
      if(wrapperValue.constructor.name == "Object") { return Object.assign({}, wrapperValue); }
      return Object.assign({}, {value: wrapperValue}).value 
    }
  }
  static of(x) { return new this(x) }
  when(cases) {
    for(var type_name in cases) {
      if(this.constructor.name == type_name) { return cases[type_name](this.value()) }
    }
    return cases["_"](this.value())
  }
}

class Success extends Wrapper {}
class Failure extends Wrapper {}
class Failures extends Wrapper {}
class HttpException extends Wrapper {}

let fetch = (options) => {
  return new Promise((resolve, reject) => {
    const lib = require(options.protocol)
    options.protocol+=":"

    const request = lib.request(options, (response) => {
      // http errors
      if (response.statusCode < 200 || response.statusCode > 299) {
        reject(new Error('Failed to load data, status code: ' + response.statusCode))
      }
      const body = []
      response.on('data', (chunk) => body.push(chunk)) // on content, push it to body
      response.on('end', () => resolve(body.join(''))) // resolve promise when terminated
    })

    request.on('error', (err) => reject(err))

    if((request.method=="GET") || (request.method=="DELETE")) { // GET OR DELETE
      request.end()
    } else { // POST OR PUT
      if((request.method=="POST") || (request.method=="PUT")) {
        request.write(options.data)
        request.end()
      } else {
        // WIP 🚧
      }
    }
  })
}

class Client {
  constructor({service}, ...features) {
    this.service = service
    this.baseUri = service.domain+service.root;
    this.headers = {
      "Content-Type": "application/json; charset=utf-8"
    };
    return Object.assign(this, ...features);
  }

  healthCheck() {
    let serviceurl = url.parse(this.service.domain)
    
    return fetch({
      protocol: serviceurl.protocol.slice(0, -1), // remove ":"
      host: serviceurl.hostname,
      port: serviceurl.port,
      method: "GET",
      path: `/healthcheck`,
      headers:  {"Content-Type": "application/json; charset=utf-8"}
    }).then(data => {
      return JSON.parse(data)
    }).catch(error => error)  
  }

  callMethod({name, urlParams=[], data=null}) {

    let method = this.service.methods.find(method => method.name == name)
    let params = urlParams.length==0 ? "" : "/" + urlParams.join("/")    
    let serviceurl = url.parse(this.service.domain)    
    
    return fetch({
      protocol: serviceurl.protocol.slice(0, -1), // remove ":"
      host: serviceurl.hostname,
      port: serviceurl.port,
      method: method.type,
      path: `${this.service.root}${method.path}${params}`,      
      headers:  {"Content-Type": "application/json; charset=utf-8"},
      data: data!==null ? JSON.stringify(data) : null
    }).then(data => {
      return JSON.parse(data)
    }).catch(error => error)  
  }
}

class Service {
  constructor({discoveryBackend=null, record=null, secure=false}) {
    this.discoveryBackend = discoveryBackend
    this.record = record
    this.routes = []

    let when404 = (request, response) => {
      response.writeHead(404, {"Content-Type": "application/json; charset=utf-8"});
      response.write(JSON.stringify({error: `${request.method} ${request.url} Not Found`, code: 404}))
      response.end();
    }

    let when500 = (err, request, response) => {
      response.writeHead(500, {"Content-Type": "application/json; charset=utf-8"});
      response.write(JSON.stringify({error: `Internal Server Error`, code: 500}))
      response.end();
    }

    http.ServerResponse.prototype.sendText = function(content={}, code=200) {
      this.writeHead(code, {"Content-Type": "text/plain; charset=utf-8"});
      this.write(content)
      this.end();
    }

    http.ServerResponse.prototype.sendJson = function(content={}, code=200) {
      this.writeHead(code, {"Content-Type": "application/json; charset=utf-8"});
      this.write(JSON.stringify(content))
      this.end();
    }

    http.ServerResponse.prototype.sendHtml = function(content={}, code=200) {
      this.writeHead(code, {"Content-Type": "text/html; charset=utf-8"});
      this.write(content)
      this.end();
    }

    let httpProtocol = secure ? https : http

    this.server = httpProtocol.createServer((request, response) => {
      try {
        // ⚠️ no request params (query string)
        if((request.method=="GET") || (request.method=="DELETE")) {
          let route = this.routes.find(rt => request.url.startsWith(rt.uri) && rt.method == request.method)
          
          if(route) {
            request.params = request.url.split(route.uri)[1].split("/").filter(item => item !== "")
            route.f(request, response)
          } else {
            when404(request, response)
          }
        } else {
          if((request.method=="POST") || (request.method=="PUT")) {
            if(request.method=="POST") { // --- POST ---
              let route = this.routes.find(rt => request.url == rt.uri && rt.method == request.method)
              if(route) {
                const body = []
                request.on('data', (chunk) => body.push(chunk)) // on content, push it to body
                request.on('end', () => { // resolve promise when terminated
                  request.body = request.headers['content-type'].startsWith("application/json") ? JSON.parse(body.join('')) : body.join('')
                  route.f(request, response)
                })
              } else {
                when404(request, response)
              } 
            } // --- END POST ---

            if(request.method=="PUT") { // --- PUT ---
              let route = this.routes.find(rt => request.url.startsWith(rt.uri) && rt.method == request.method)
              if(route) {
                // the difference with POST
                request.params = request.url.split(route.uri)[1].split("/").filter(item => item !== "")
                const body = []
                request.on('data', (chunk) => body.push(chunk))
                request.on('end', () => {
                  request.body = request.headers['content-type'].startsWith("application/json") ? JSON.parse(body.join('')) : body.join('')
                  route.f(request, response)
                })
              } else {
                when404(request, response)
              }                
            } // --- END PUT ---
            
          } else {
            when500("😡 Houston? We have a problem!", request, response)
          }
        }

      } catch (error) {when500(error, request, response) }
    })
    
    this.routes.push({ /* --- health check --- */
      uri: "/healthcheck",
      method: "GET",
      f: (request, response) => {
        if(record) {
          console.log("👩‍⚕️ health checking of ", this.record)
          response.sendJson(this.record)
        } else { // eg: for the DiscoveryBackenServer
          response.sendJson({})
        }
      }
    })

    function bye(service, cause) {
      if(service.discoveryBackend) {
        service.removeRegistration(res => {
          service.stop(cause)
          process.exit()
        })
      } else { // eg a backend service is not really a sevice
        process.exit()
      }
    }

    if(this.discoveryBackend) {
      //do something when app is closing
      process.on('exit', bye.bind(null, this, 'exit'));
      //catches ctrl+c event
      process.on('SIGINT', bye.bind(null, this, 'SIGINT'));
      //catches uncaught exceptions
      process.on('uncaughtException', bye.bind(null, this, 'uncaughtException'));
    }
  }

  createRegistration(callBack) {
    this.discoveryBackend.createRegistration(this.record, registrationResult => {
      registrationResult.when({
        Success: registrationId => callBack(Success.of({message: "😃 registration is ok", record: this.record})),
        Failure: error => callBack(Failure.of({message: "😡 registration is ko", error: error}))
      }) // end when
    }) // end create
  } // end register

  updateRegistration(callBack) {
    this.discoveryBackend.updateRegistration(this.record, registrationResult => {
      registrationResult.when({
        Success: registrationId => callBack(Success.of({message: "😃 registration is updated", record: this.record})),
        Failure: error => callBack(Failure.of({message: "😡 registration update is ko", error: error}))
      }) // end when
    }) 
  } 

  removeRegistration(callBack) {
    this.discoveryBackend.removeRegistration(this.record, registrationResult => {
      registrationResult.when({
        Success: registrationId => callBack(Success.of({message: "😃 record is deleted", record: this.record})),
        Failure: error => callBack(Failure.of({message: "😡 delete of record is ko", error: error}))
      }) // end when
    }) // end update
  }

  add({uri, method, f}) { this.routes.push({uri, method, f}) }
  get({uri, f}) { this.add({uri, method:"GET", f}) }
  delete({uri, f}) { this.add({uri, method:"DELETE", f}) }
  post({uri, f}) { this.add({uri, method:"POST", f}) }  
  put({uri, f}) { this.add({uri, method:"PUT", f}) }

  heartbeat({interval, f}) {
    function updateStatusOfService(service) {
      return function() {
        service.updateRegistration(registration => {
          registration.when({
            Failure: error => f(Failure.of(error)),
            Success: serviceRecord => f(Success.of(serviceRecord))
          })
        })
      }
    } // end function updateStatusOfService()
    setInterval(updateStatusOfService(this), interval);  
  }

  start({port}, callback) {
    try {
      this.server.listen(port)
      callback(Success.of(port))
    } catch (error) {
      callback(Failure.of(error))
    }
  }
}

class DiscoveryBackendServer {
  constructor() {
    this.servicesDirectory = {} 
    this.service = new Service({})

    this.service.get({uri:`/api/services`, f: (request, response) => {
      let keyServices = request.params[0]
      if(keyServices) { 
        response.sendJson({services: this.servicesDirectory[keyServices]})
      } else {
        response.sendJson({services: this.servicesDirectory})
      }
    }})

    // create registration in the directory service
    this.service.post({uri:`/api/services`, f: (request, response) => {
      let data = request.body
      if(this.servicesDirectory[data.keyServices]==undefined) {
        this.servicesDirectory[data.keyServices] = []
      } 
      data.record.date = {}
      data.record.date.creation = new Date()
      data.record.date.lastUpdate = new Date()

      this.servicesDirectory[data.keyServices].push(data.record)
      response.sendJson({registration: data.record.registration})
    }})

    this.service.delete({uri:`/api/services`, f: (request, response) => {
      //TODO try catch : when the service does not exists in the directory
      let keyServices = request.params[0]
      let serviceId = request.params[1]

      if(this.servicesDirectory[keyServices]) { // the service is registered
        let serviceObject = this.servicesDirectory[keyServices].find(item=>item.registration==serviceId)
        let index = this.servicesDirectory[keyServices].indexOf(serviceObject)
        // delete the item
        if (index > -1) {
          this.servicesDirectory[keyServices].splice(index, 1)
        }
      } 
      response.sendJson({registration: serviceId})
    }})   

    // update registration in the directory service
    this.service.put({uri:`/api/services`, f: (request, response) => {
      let keyServices = request.params[0]
      let serviceId = request.params[1]
      let data = request.body
      // update the directory
      let serviceObject = this.servicesDirectory[keyServices].find(item=>item.registration==serviceId)
      let index = this.servicesDirectory[keyServices].indexOf(serviceObject)
      // update and replace the item
      
      data.record.date = serviceObject.date
      data.record.date.lastUpdate = new Date()

      if (index > -1) {
        this.servicesDirectory[keyServices][index] = data.record
      }
      response.sendJson({registration: data.record.registration})
    }}) 

    // always in last position
    this.service.get({uri:`/`, f: (request, response) => {
      response.sendJson({message: "👋 Hello, I'm the pico discovery backend server"})
    }})
  }

  checkServices({interval, f}) {
    function updateStatusesOfServices(servicesDirectory) {
      return function() {
        for(var keyServices in servicesDirectory) {
          servicesDirectory[keyServices].forEach(serviceRecordInDirectory => {
            let client = new Client({service: serviceRecordInDirectory})
            client.healthCheck()
            .then(record => { // record of healthcheck
              f(Success.of(serviceRecordInDirectory))
            })
            .catch(error => f(Failure.of(error)))
          })
        }
      }
    } // end function updateStatusesOfServices()
    setInterval(updateStatusesOfServices(this.servicesDirectory), interval);
  }

  start({port}, callback) {
    this.service.start({port: port}, res => {
      res.when({
        Failure: error => callback(Failure.of(error)),
        Success: port => callback(Success.of(port))
      })
    })
  }
}

let S4 = () => (((1+Math.random())*0x10000)|0).toString(16).substring(1)
let guid = () => (S4() + S4() + "-" + S4() + "-4" + S4().substr(0,3) + "-" + S4() + "-" + S4() + S4() + S4()).toLowerCase()

class DiscoveryBackend {
  constructor({protocol, host, port, keyServices}) {
    this.protocol = protocol
    this.host = host
    this.port = port
    this.keyServices = keyServices
  }

  healthcheck(callback) {
    fetch({
      protocol: this.protocol, host: this.host, port: this.port,
      path: `/healthcheck`,
      method: 'GET',
      headers:  {"Content-Type": "application/json; charset=utf-8"}
    }).then(data => { // removeRegistration ok      
      callback(Success.of(JSON.parse(data)))
    }).catch(err => { // removeRegistration ko      
      callback(Failure.of(err))
    })
  }

  getAllRegistrations(callback) {
    fetch({protocol: this.protocol, host: this.host, port: this.port,
      path: `/api/services/${this.keyServices}`,
      method: 'GET',
      headers:  {"Content-Type": "application/json; charset=utf-8"}
    }).then(data => { // removeRegistration ok    
      callback(Success.of(JSON.parse(data)))
    }).catch(err => { // removeRegistration ko      
      callback(Failure.of(err))
    })
  }

  getServices({filter}, callback) {
    if(filter) {
      this.getAllRegistrations(results => {
        results.when({
          Failure: err => callback(Failure.of(err)),
          Success: data => {
            if(data.services) {
              callback(Success.of(data.services.filter(filter)))
            } else { // no services
              callback(Success.of({}))
            }
          }
        })
      })
    } else {
      this.getAllRegistrations(results => {
        results.when({
          Failure: err => callback(Failure.of(err)),
          Success: data => {
            if(data.services) {
              callback(Success.of(data.services))
            } else { // no services
              callback(Success.of({}))
            }          
          }
        })
      })
    }
  }

  createRegistration(record, callback) {
    record.registration = guid()
    fetch({protocol: this.protocol, host: this.host, port: this.port,
      path: "/api/services",
      method: 'POST',
      data:JSON.stringify({record:record, keyServices: this.keyServices}),
      headers:  {"Content-Type": "application/json; charset=utf-8"}
    }).then(data => { // registration ok      
      callback(Success.of(record.registration))
    }).catch(err => { // registration ko      
      callback(Failure.of(err))
    })
  }

  removeRegistration(record, callback) {
    fetch({protocol: this.protocol, host: this.host, port: this.port,
      path: `/api/services/${this.keyServices}/${record.registration}`,
      method: 'DELETE',
      headers:  {"Content-Type": "application/json; charset=utf-8"}
    }).then(data => { // removeRegistration ok      
      callback(Success.of(record.registration))
    }).catch(err => { // removeRegistration ko      
      callback(Failure.of(err))
    })
  }

  updateRegistration(record, callback) {
    fetch({protocol: this.protocol, host: this.host, port: this.port,
      path: `/api/services/${this.keyServices}/${record.registration}`,
      method: 'PUT',
      data:JSON.stringify({record:record, keyServices: this.keyServices}),
      headers:  {"Content-Type": "application/json; charset=utf-8"}
    }).then(data => { // registration ok      
      callback(Success.of(record.registration))
    }).catch(err => { // registration ko      
      callback(Failure.of(err))
    })
  }
}

module.exports = {
  Wrapper: Wrapper, Success: Success, Failure: Failure, Failures: Failures, fetch: fetch,
  Service: Service, Client: Client,
  DiscoveryBackendServer: DiscoveryBackendServer, DiscoveryBackend: DiscoveryBackend
}
