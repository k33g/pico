const {DiscoveryBackendServer} = require('../../index')

let port = process.env.PORT || 9099;

let backend = new DiscoveryBackendServer()

backend.start({port: port}, res => {
  res.when({
    Failure: error => console.log("😡 Houston? We have a problem!"),
    Success: port => {
      console.log(`🌍 pico discovery backend server is started on ${port}`)

      // date and age have to be computed by the backen server (to be sure of the time)

      backend.checkServices({interval: 5000, f: healthResponse => {
        healthResponse.when({
          Failure: error => console.log("⛑", error),
          Success: record => { // record of directory
            console.log("❤️", record)
            let age = (new Date() - new Date(record.date.lastUpdate).getTime()) / 1000
            console.log("⚠️ age since last update:", age, "record", record)
          }
        })
      }})

    }
  })
})
