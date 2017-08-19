const {DiscoveryBackendServer} = require('../../index')

let port = process.env.PORT || 9099;
let externalPort = process.env.EXTERNAL_PORT || port;

let backend = new DiscoveryBackendServer()

backend.start({port: port}, res => {
  res.when({
    Failure: error => console.log("😡 Houston? We have a problem!"),
    Success: port => console.log(`🌍 pico discovery backend is started on ${port}`)
  })
})