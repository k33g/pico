const {Service, DiscoveryBackend} = require('../../index')

let discoveryPort = process.env.DISCOVERY_PORT || 9099;

let discoveryBackend = new DiscoveryBackend({
  protocol:`http`, 
  host:`localhost`,
  port:discoveryPort,
  keyServices:"domain-demo"
})

let port = process.env.PORT || 9090;

let record = {
  name: "calc",
  domain: `http://localhost:${port}`,
  root:"/api",
  methods: [
    {name: "add1", type: "GET", path: "/add"},
    {name: "add2", type: "POST", path: "/add"}],
  metadata: {
    kind: "http"
  }
}

let calcService = new Service({discoveryBackend: discoveryBackend, record: record})

// do something when you stop, quit, ...
// the unregistration from the Discovery Backend Server is automatic
calcService.stop = (cause) => {
  console.log(`👋 ${calcService.record.registration} ${cause}`)
}

/**
 * usage: curl http://localhost:9090/api/add/40/2
 */
calcService.get({uri:`/api/add`, f: (request, response) => {
  let a = parseInt(request.params[0])
  let b = parseInt(request.params[1])
  response.sendJson({message: "Hello 🌍", from:"pico", result: a + b})
}})

/**
 * usage: 
 */
calcService.post({uri:`/api/add`, f: (request, response) => {
  let data = request.body
  response.sendJson({message: "Hey 👋", from:"pico" , result: data.a + data.b})
}})


calcService.createRegistration(registration => {
  registration.when({
    Failure: (err) => console.log("🙀", err),
    Success: record => console.log("😻 registration is ok:", record)
  })
})

calcService.start({port: port}, res => {
  res.when({
    Failure: error => console.log("😡 Houston? We have a problem!"),
    Success: port => {

      calcService.record.status = "UP"      
      calcService.updateRegistration(registration => {
        registration.when({
          Failure: error => console.log("😡 update registration is ko", error),
          Success: value => console.log("😍 registration updated", value)
        })
      })
      console.log(`🌍 calcService is listening on ${port}`)
    }
  })
})
