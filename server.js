//.env variables
//require('dotenv').config()
const express = require('express')
const app = express()
const server = require('http').Server(app)
const io = require('socket.io')(server)
const { v4: uuidV4 } = require('uuid')
const compression = require('compression')
const { Console } = require('console')
const bodyParser = require('body-parser');
const async = require('async')
const PORT = process.env.PORT || 3000
let data = [[], []]

app.set('view engine', 'ejs')
app.use(bodyParser.urlencoded({ extended: true }));
//app.use(express.json()); // Used to parse JSON bodies
//app.use(express.urlencoded()); 

app.use(express.static('public'))
app.use(compression({
    level: 6,
    threshold: 0,
}))

app.get('/', (req, res) => {
    //res.redirect(`/${uuidV4()}`)
    res.render(`index`, { roomId: uuidV4()})
})

app.get('/onlinegames', (req, res) => {
    res.render('gamelistpage');
})

app.get('/workshops', (req, res) => {
    res.render('workshoplistpage');
})

app.get('/freepaidworkshops', (req, res) => {
    var filter = req.query.category;
    console.log("helll"+filter);
    res.render('freepaidworkshoplistpage', {filterValue: filter});
})

app.get('/therapists', (req, res) => {
    var location = req.query.therapistLocation;
    console.log("helll"+location);
    res.render('therapistlistpage', {therapistLocation: location});
})

app.get('/mandalaworkshop', (req,res) => {
    res.render('mandalaworkshopregistration');
})
app.get('/crochetworkshop', (req,res) => {
    res.render('crochetworkshopregistration');
})
app.get('/zentangleworkshop', (req,res) => {
    res.render('zentangleworkshopregistration');
})
app.get('/potteryworkshop', (req,res) => {
    res.render('potteryworkshopregistration');
})

app.get('/openart', (req, res) => {
    res.render('openart', { roomId: uuidV4()})
})

app.get('/:room', (req, res) => { 
    var dprompt = req.query.prompt;
    console.log("ppp"+dprompt)
    res.render('room', { roomId: req.params.room, drawingPrompt: dprompt })
})

/*app.get('/therapists', (req, res) => {
    res.render('therapistlistpage', { therapistLocation: req.body.therapistLocation })
})*/

io.on('connection', socket => {
    socket.on('join-room', (roomID, userID) => {
        socket.join(roomID)

        data[0].push(socket.id)
        data[1].push(roomID)

        let userData = socket.id + " " + roomID
        io.to(socket.id).emit('name room', userData)
        // socket.to(roomId).emit('user-connected', userId)

        socket.on('send object', function (objectJSON) {
            socket.to(roomID).emit('get object', objectJSON)
        })

        // socket.on('get board', function (reuqester) {
        //     let requesterRoom = reuqester.substring(21, 57)
        //     if (data[0].length != 1) {
        //         let matchingIndexes = []
        //         data[1].forEach((currentItem, index) => {
        //             currentItem === requesterRoom ? matchingIndexes.push(index) : null
        //         })
        //         if (matchingIndexes.length != 1) {
        //             let mateString = matchingIndexes[0]
        //             let mateID = data[0][mateString]
        //             let requesterID = reuqester.substring(0, 20)
        //             io.to(mateID).emit('get requester', requesterID)
        //         }
        //     }
        // })

        // socket.on('send board', (requesterID, previousJSON) => {
        //     io.to(requesterID).emit('get board', previousJSON)
        // })

        socket.on('send command', function (command) {
            socket.to(roomID).emit('get command', command)
        })

        socket.on('disconnect', () => {
            socket.to(roomID).emit('user-disconnected', userID)
            let user = data[0].indexOf(socket.id)
            let room = data[1].indexOf(roomID)
            data[0].splice(user, 1)
            data[1].splice(room, 1)
        })

        socket.emit('countdown', { minutes: 1, seconds: 30 });

        // Handle extend countdown events from clients
        socket.on('extendCountdown', () => {
            countdownTimeInSeconds += 45;
            endTime = Date.now() + countdownTimeInSeconds * 1000;
            updateCountdown();
        });
    })
    // Send the initial countdown when a client connects
  
})

let countdownTimeInSeconds = 90;
let endTime = Date.now() + countdownTimeInSeconds * 1000;

function updateCountdown() {
  const currentTime = Date.now();
  const remainingTime = Math.max(0, endTime - currentTime);
  const minutes = Math.floor(remainingTime / (1000 * 60));
  const seconds = Math.floor((remainingTime % (1000 * 60)) / 1000);

  // Broadcast the countdown to all connected clients
  io.emit('countdown', { minutes, seconds });

  if (minutes === 0 && seconds === 0) {
    // Reset to initial countdown time
    resetCountdown();
  }
}

function resetCountdown() {
  countdownTimeInSeconds = 90;
  endTime = Date.now() + countdownTimeInSeconds * 1000;
  updateCountdown();
}

/*io.on('connection', (socket) => {
  // Send the initial countdown when a client connects
  socket.emit('countdown', { minutes: 1, seconds: 30 });

  // Handle extend countdown events from clients
  socket.on('extendCountdown', () => {
    countdownTimeInSeconds += 45;
    endTime = Date.now() + countdownTimeInSeconds * 1000;
    updateCountdown();
  });
});*/

setInterval(updateCountdown, 1000);

/*connectDb().then(() => {
    server.listen(PORT, () => {
        console.log('Running on port ' + PORT);
    })
})*/
server.listen(PORT, () => {
    console.log('Running on port ' + PORT)
})

// socket.on('new user', (usr) => {
//     socket.username = usr;
//     console.log('Подключился пользователь - Имя: ' + socket.username);
// });