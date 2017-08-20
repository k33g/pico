const {Service, DiscoveryBackend} = require('../../index')

let discoveryPort = process.env.DISCOVERY_PORT || 9099;

let discoveryBackend = new DiscoveryBackend({
  protocol:`http`, 
  host:`localhost`,
  port:discoveryPort,
  keyServices:"domain-two"
})

let port = process.env.PORT || 9091;

let record = {
  name: "hi",
  domain: `http://localhost:${port}`,
  root:"/api",
  methods: [
    {name: "hey", type: "GET", path: "/hey"}
  ],
  metadata: {
    kind: "http"
  }
}

let service = new Service({discoveryBackend: discoveryBackend, record: record})

// do something when you stop, quit, ...
// the unregistration from the Discovery Backend Server is automatic
service.stop = (cause) => {
  console.log(`👋 ${service.record.registration} ${cause}`)
}

service.get({uri:`/api/hey`, f: (request, response) => {
  response.sendJson({message: "Hey 👋 🌍"})
}})

service.createRegistration(registration => {
  registration.when({
    Failure: (err) => console.log("🙀", err),
    Success: record => console.log("😻 registration is ok:", record)
  })
})

service.start({port: port}, res => {
  res.when({
    Failure: error => console.log("😡 Houston? We have a problem!"),
    Success: port => {
      console.log(`🌍 service is listening on ${port}`)

      service.updateRegistration(registration => {
        registration.when({
          Failure: error => console.log("😡 update registration is ko", error),
          Success: value => console.log("😍 registration updated", value)
        })
      })
    }
  })
})
