const express = require('express')
const cors = require('cors')
const jwt = require('jsonwebtoken')
// const { MongoClient, ServerApiVersion } = require('mongodb');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb')
const nodemailer = require("nodemailer");
require('dotenv').config();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)


const app = express()
const port = process.env.PORT || 5000


// middlewares
app.use(cors())
app.use(express.json())

// Database Connection 
const uri = process.env.DB_URI
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
})

// send email 
const sendMail = (emailData,email ) =>{
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL,
      pass: process.env.PASSWORD,
    }
  })

  const mailOptions = { 
    from: process.env.EMAIL,
    to: email,
    subject: emailData?.subject,
    html: `<p>${emailData?.message}</p>`
  }

  transporter.sendMail(mailOptions, function(error, info){
    if (error) {
   console.log(error);
    } else {
      console.log('Email sent: ' + info.response);
      // do something useful
    }
  });


}


async function run() {
  try {
    const homesCollection = client.db('airCnC').collection('homes')
    const usersCollection = client.db('airCnC').collection('users')
    const bookingsCollection = client.db('airCnC').collection('bookings')


    
    // Save user email & generate JWT 
    app.put('/user/:email', async (req,res) => {
      const email = req.params.email
      const user = req.body 
      const filter = {email: email}
      const options = {upsert: true}
      const updateDoc = {
        $set: user,
      }
      const result = await usersCollection.updateOne(filter, updateDoc, options)
      console.log(result)
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: '1d',
      })
      console.log(token)
      res.send({ result, token})
    })

    // Get a single user by email 
    app.get('/user/:email', async (req,res) => {
      const email = req.params.email
      const query = {email: email}
      const user = await usersCollection.findOne(query)
      console.log(user);
      res.send(user)

    })

    // Get all user 
    app.get('/users/', async (req,res) => {
      const user = await usersCollection.find().toArray()
      console.log(user);
      res.send(user)

    })
    // Get all home 
    app.get('/all-homes/',async(req,res) => {
      const home = await homesCollection.find().toArray()
      console.log(home);
      res.send(home)
    })
    // get single home 
    app.get('/home/:id', async (req,res) => {
      const id = req.params.id;
      const query = {_id: ObjectId(id)}
      const home = await homesCollection.findOne(query)
      res.send(home)
      

    })

    // Save a booking 
    app.post ('/bookings', async (req,res) => {
      const bookingData = req.body
      const result = await bookingsCollection.insertOne(bookingData)
      // console.log(result);
      sendMail({
        subject:'Booking Successful!',
        message:`Booking Id: ${result?.insertedId} `},  
        bookingData?.guestEmail)
      res.send(result)

    })

    // create payment intent 
    app.post('/create-payment-intent', async ( req,res) => {
      const price = req.body.price;
      console.log(price);
      const amount = parseFloat(price * 100);
      try{
        const paymentIntent = await stripe.paymentIntents.create({
          amount: amount,
          currency: 'usd',
          payment_method_types: ['card'],
        })
        res.send({ clientSecret: paymentIntent.client_secret })

      }catch (err){
        err=>console.log(err);
      }

    } )



    // get a booking
    app.get('/bookings', async (req,res) => {
      let query = {}
      const email = req.query.email;
      if(email){
        query = {
          guestEmail: email,
        }

      }
      const booking = await bookingsCollection.find(query).toArray()
      console.log(booking);
      res.send(booking);
    })
    
     // Get a single booking
     app.get('/booking/:id', async (req, res) => {
      const id = req.params.id
      const query = { _id: ObjectId(id) }
      const booking = await bookingsCollection.findOne(query)
      res.send(booking)
    })

    // Cancle a booking 
    app.delete('/booking/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id)}
      const result = await bookingsCollection.deleteOne(query)
      res.send(result)

    })


    //post a home
    app.post ('/homes', async (req,res) => {
      const homeData = req.body
      const result = await homesCollection.insertOne(homeData)
      console.log(result);
      res.send(result)

    })

    console.log('Database Connected...')
  } finally {
  }
}

run().catch(err => console.error(err))

app.get('/', (req, res) => {
  res.send('Server is running....')
})

app.listen(port, () => {
  console.log(`Server is running...on ${port}`)
})
