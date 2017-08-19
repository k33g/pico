const {send} = require('micro')

module.exports = async (req, res) => {
  const statusCode = 200
  const data = {message:"Welcome", from:"Micro"}

  send(res, statusCode, data)
}

// tests
//  ab -n 10000 -c 10 http://localhost:3000/