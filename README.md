# Pico

**Pico** is a library to create HTTP **picoservices**. (... and more)

- **Pico** is pico: only **one** file with **zero** dependency, less than **500 SLOC** and less than **20 KB**
- **Pico** is **"☁️ Cloud Native"**
- **Pico** provides several necessary tools to develop picoservices:
  - `Service`: the core of **Pico** with a embedded simple healthcheck system and a "minimalistic" (but sufficient) router
  - `DiscoveryBackendServer`: a minimalist "in memory" system of Service Discovery (only http, with a REST api) 
  - `DiscoveryBackend`: the component to discover, publish and unpublish picoservices
  - `Client`: the component to call the methods of the picoservices

> ⚠️ disclaimer: I ❤️ [Vert.x](http://vertx.io/), and all here is totaly inspired by this ✨ framework

> ⚠️ you need at least node v7.7.2 | tests has been done with node v8.4.0

## Install

### 1st way

```shell
npm install git+https://git@github.com/k33g/pico.git --save
```

and use it like that:

```javascript
const {Service} = require('pico')
```

### 2nd way

As **Pico** is a library with 0 dependency, you can jut copy it in your project:

```shell
curl -o pico.js https://raw.githubusercontent.com/k33g/pico/master/index.js
```

and use it like that:

```javascript
const {Service} = require('./pico')
```

So, you don't even need to launch a `npm` command to fetch distant files when deploying 😁

## Write your first picoservice

```javascript
// calc.js
const {Service} = require('pico')

let calcService = new Service({})

let port = process.env.PORT || 9090;

calcService.get({uri:`/api/add`, f: (request, response) => {
  let a = parseInt(request.params[0])
  let b = parseInt(request.params[1])
  response.sendJson({message: "Hello 🌍", from:"pico", result: a + b})
}})

calcService.post({uri:`/api/add`, f: (request, response) => {
  let data = request.body
  response.sendJson({message: "Hey 👋", from:"pico" , result: data.a + data.b})
}})

calcService.start({port: port}, res => {
  res.when({
    Failure: error => console.log("😡 Houston? We have a problem!"),
    Success: port => console.log(`🌍 calcService is listening on ${port}`)
  })
})
```

### Run it & Test it

```shell
node calc.js

curl http://localhost:9090/api/add/40/2 
# you'll get: {"message":"Hello 🌍","from":"pico","result":42

 curl -H "Content-Type: application/json" -X POST -d '{"a":21,"b":21}' http://localhost:9090/api/add
 # you'll get: {"message":"Hey 👋","from":"pico","result":42
```

Easy 😉

## Make your picoservice discoverable

### First: Discovery Backend Server

First we need to create the discovery backend server (only a few lines):

```javascript
// backend.js
const {DiscoveryBackendServer} = require('pico')

let port = process.env.PORT || 9099;

let backend = new DiscoveryBackendServer()

backend.start({port: port}, res => {
  res.when({
    Failure: error => console.log("😡 Houston? We have a problem!"),
    Success: port => console.log(`🌍 pico discovery backend server is started on ${port}`)
  })
})
```

And run it: `node backend.js`

```shell
🌍 pico discovery backend server is started on 9099
```

### Then, let's modify the calcService code

```javascript
const {Service, DiscoveryBackend} = require('pico')

```
👋 we need to create a `DiscoveryBackend` instance that will allow to use the DiscoveryBackendServer REST API
```javascript
let discoveryPort = process.env.DISCOVERY_PORT || 9099;

let discoveryBackend = new DiscoveryBackend({
  protocol:`http`, 
  host:`localhost`,
  port:discoveryPort,
  keyServices:"domain-demo"
})
```
👋 we need to create a record describing our picoservice *(the `metadata` part isn't mandatory but it could be helpful to qualify a service)*
```javascript
let port = process.env.PORT || 9090;

let record = {
  name: "ola",
  domain: `http://localhost:${port}`,
  root:"/api",
  methods: [
    {name: "add1", type: "GET", path: "/add"},
    {name: "add2", type: "POST", path: "/add"}],
  metadata: {
    kind: "http"
  }
}
```
👋 then, now, we instantiate the service passing the `discoveryBackend` and the `record` to the `calcService` constructor
```javascript
let calcService = new Service({discoveryBackend: discoveryBackend, record: record})
```
👋 now we have to define a `stop` methode for `calcService`
```javascript
// do something when you stop, quit, ...
// the unregistration from the Discovery Backend Server is automatic
calcService.stop = (cause) => {
  console.log(`👋 ${calcService.record.registration} ${cause}`)
}
```
👋 the REST methods of `calcService` do not change
```javascript
calcService.get({uri:`/api/add`, f: (request, response) => {
  let a = parseInt(request.params[0])
  let b = parseInt(request.params[1])
  response.sendJson({message: "Hello 🌍", from:"pico", result: a + b})
}})

calcService.post({uri:`/api/add`, f: (request, response) => {
  let data = request.body
  response.sendJson({message: "Hey 👋", from:"pico" , result: data.a + data.b})
}})
```
👋 🥁 you can publich the service to the backend, and then start the service *(You might also want to be sure that the publication is ok to start the service)*
```javascript
calcService.createRegistration(registration => {
  registration.when({
    Failure: (err) => console.log("🙀", err),
    Success: record => console.log("😻 registration is ok:", record)
  })
})
```
👋 you can update the record of the service with the `updateRegistration`, it's useful for add data to the record of the service:
```javascript
calcService.start({port: port}, res => {
  res.when({
    Failure: error => console.log("😡 Houston? We have a problem!"),
    Success: port => {

      calcService.record.metadata.message = "Hey 👋, how are you doing?" 

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
```

And run it: `node calc.js`, you should get this:

```shell
🌍 calcService is listening on 9090
😻 registration is ok: { message: '😃 registration is ok',
  record:
   { name: 'ola',
     domain: 'http://localhost:9090',
     root: '/api',
     methods: [ [Object], [Object] ],
     metadata: { kind: 'http' },
     registration: '550db1d8-96fd-461b-fd76-cfe7f0506102' } }
```

Now, we can query the Discovery Backend Server:
```shell
curl http://localhost:9099/api/services
```
You should get this:

```shell
{"services":{
  "domain-demo":[
    {
      "name":"calc",
      "domain":"http://localhost:9090",
      "root":"/api",
      "methods":[
        {"name":"add1","type":"GET","path":"/add"},
        {"name":"add2","type":"POST","path":"/add"}
      ],
      "metadata":{"kind":"http"},
      "registration":"550db1d8-96fd-461b-fd76-cfe7f0506102"
    }
  ]}
}
```

### Then, let's create the code to use the calcService code

```javascript
const {Client, DiscoveryBackend} = require('../../index')

let discoveryPort = process.env.DISCOVERY_PORT || 9099;

let discoveryBackend = new DiscoveryBackend({
  protocol:`http`, 
  host:`localhost`,
  port:discoveryPort,
  keyServices:"domain-demo"
})

discoveryBackend.getServices({filter: service => service.name == "calc" },  results => {
  results.when({
    Failure: error => console.log("😡 Houston? We have a problem!", error),
    Success: servicesRecords => {
      let selectedService = servicesRecords[0] // get the first service with a name == "calc"
      // create a client from the record
      let client = new Client({service: selectedService})
      
      // check that the service is ok and then call the service methods by name
      client.healthCheck().then(res => {
        
        client.callMethod({name:"add1", urlParams:[40,2]}).then(res => console.log(res)) // GET picoservice

        client.callMethod({name:"add2", data:{a:21, b: 21} }).then(res => console.log(res)) // POST picoservice
      })
    }
  })
})
```

### By the way, health checking...

Before querying the `discoveryBackend` you can do a **"healthcheck"**. (In fact `discoveryBackend` is a service too).

```javascript
discoveryBackend.healthcheck(results => {
  results.when({
    Failure: error => console.log("😡 Houston? We have a problem!", error),
    Success: data => console.log("😁 DiscoveryBackend is", data)
  })
})
```

```shell
😁 DiscoveryBackend is { status: 'UP' }
```

> Each **picoservice** service exposes a `/healthcheck` API and you can check it like this `curl http://localhost:9090/healthcheck/` or using the `healthCheck` method of the service client

> ⚠️ **health checking** is important: eg you can check periodically the health of the discovery backend. If you detect that it has been restarted you can republish again your picoservice.

### DiscoveryBackend server and Service(s),... on cloud platforms

> ⚠️ this part must be rewritten (something simpler)

When you use a cloud platform and you perform deployment, stop and restart of VM (or container), ... your **"picoservices"** could/shoul exist several times, (eg:if you practice "blue-green" deployment you need several version of the picoservice deployed on several VM or containers), so you could get a list of picoservices with the same name and the same url but with different registration id.

You'll get the same kind of problem if you use horizontal scalabilty of the picoservice VM (or container)

The `Service` instance provides a `heartbeat` method that periodically updates its registration (with date and time) to the Discovery Backend Server:

```javascript
service.heartbeat({interval: 5000, f: res => {
  res.when({ // if error -> the backend server is probably down
    Failure: error => console.log("😡 update registration is ko", error),
    Success: serviceRecord => console.log("😍 registration updated", serviceRecord)
  })
}})
```

The `DiscoveryBackendServer` instance provides a `checkServices` method that periodically parses the list of picoservices records and do a healthcheck for each picoservice:

```javascript
backend.checkServices({interval: 5000, f: healthResponse => {
  healthResponse.when({
    Failure: error => console.log("⛑", error),
    Success: record => { // record of directory
      let age = (new Date() - new Date(record.date.lastUpdate).getTime()) / 1000
      console.log("⚠️ age since last update:", age, "record", record)
    }
  })
}})
```

So you can calculate the age of the picoservice, and if its age constantly increases, this is probably a picoservice deployed on a stopped/removed VM or container. So you can remove it of the list of the Discovery Backend Server.

## Performances

These part is to read with the usual precautions:

The tests has been made on a MacBook (Retina, 12-inch, Early 2016) with a Processor 1,1 GHz Intel Core m3 and Memory 8 GB 1867 MHz LPDDR3.

I compared **Pico** with **Micro** [https://zeit.co/blog/micro-8](https://zeit.co/blog/micro-8)

I used these commands with **ApacheBench, Version 2.3**:

```shell
# Pico
ab -n 10000 -c 10 http://localhost:4000/api/welcome/
# Micro
ab -n 10000 -c 10 http://localhost:3000/
```

You can find the source code of the tests here `/examples/03-performances-tests`

### Pico report

```shell
Server Software:
Server Hostname:        localhost
Server Port:            4000

Document Path:          /api/welcome/
Document Length:        35 bytes

Concurrency Level:      10
Time taken for tests:   3.056 seconds
Complete requests:      10000
Failed requests:        0
Total transferred:      1570000 bytes
HTML transferred:       350000 bytes
Requests per second:    3271.75 [#/sec] (mean) 🤗 I am pretty happy 
Time per request:       3.056 [ms] (mean)
Time per request:       0.306 [ms] (mean, across all concurrent requests)
Transfer rate:          501.63 [Kbytes/sec] received

Connection Times (ms)
              min  mean[+/-sd] median   max
Connect:        0    0   2.4      0     234
Processing:     1    3   7.9      2     235
Waiting:        1    3   7.9      2     234
Total:          1    3   8.2      2     235

Percentage of the requests served within a certain time (ms)
  50%      2
  66%      3
  75%      3
  80%      3
  90%      4
  95%      5
  98%      6
  99%      6
 100%    235 (longest request)
```

### Micro report

```shell
Server Software:
Server Hostname:        localhost
Server Port:            3000

Document Path:          /
Document Length:        36 bytes

Concurrency Level:      10
Time taken for tests:   3.300 seconds
Complete requests:      10000
Failed requests:        0
Total transferred:      1630000 bytes
HTML transferred:       360000 bytes
Requests per second:    3029.99 [#/sec] (mean)
Time per request:       3.300 [ms] (mean)
Time per request:       0.330 [ms] (mean, across all concurrent requests)
Transfer rate:          482.31 [Kbytes/sec] received

Connection Times (ms)
              min  mean[+/-sd] median   max
Connect:        0    0   0.2      0       6
Processing:     0    3   6.0      2     175
Waiting:        0    3   6.0      2     175
Total:          1    3   6.0      3     175

Percentage of the requests served within a certain time (ms)
  50%      3
  66%      3
  75%      3
  80%      4
  90%      5
  95%      6
  98%      7
  99%      8
 100%    175 (longest request)
```

## TODO

- circuit breaker
- document the source
- easy method for DiscoveryBackendServer to delete service in the list
