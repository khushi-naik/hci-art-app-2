const socket = io('/')

socket.emit('join-room', ROOM_ID, 10)
// socket.on('user-connected', userId => {
//     console.log('User connected: ' + userId)
// })

// Get user name and room name
// socket.on('name room', userData => {
//     socket.emit('get board', userData)
// })

// Socket emit
// Send object
function emitObject(event) {
    socket.emit('send object', JSON.stringify(event.outerHTML))
}

// Emit modified object/group
// function emitModified(type) {
//     let newObject = canvas.getActiveObject()
//     let json = JSON.stringify(newObject.toJSON(['name']))
//     let data

//     if (type == "group") {
//         data = {
//             json: json,
//             grouped: "true",
//             modified: "false"
//         }
//     } else if (type == "object") {
//         data = {
//             json: json,
//             grouped: "false",
//             modified: "true"
//         }
//     }

//     socket.emit('drawing', data)
//     lastObject = newObject
// }

// Send command
function sendCommand(command) {
    socket.emit('send command', JSON.stringify(command))
}

// Socket on
// Get object
socket.on('get object', function (objectJSON) {
    let object = JSON.parse(objectJSON)
    let objectHasScript = object.indexOf('script')
    if (objectHasScript == -1) {
        scene.insertAdjacentHTML('beforeend', object)
    } else {
        console.log('Board sync failed!');
    }
})

// Get command
socket.on('get command', function (cmd) {
    let command = JSON.parse(cmd)
    if (command == "undo") {
        undo()
    } else if (command == "redo") {
        redo()
    } else if (command == "clear") {
        clearBoard()
    } else if (command == "none") {
        setPattern(command)
    } else if (command == "sq") {
        setPattern(command)
    } else if (command == "line") {
        setPattern(command)
    } else if (command == "dot") {
        setPattern(command)
    } else if (command == "deleteDone") {
        // addToStory('object')
    } else {
        canvas.remove(canvas.getItemByName(command))
    }
})

// // Get canvas
// socket.on('get board', function (object) {
//     canvas.loadFromJSON(object.data)
//     undo_history = object.undo
//     redo_history = object.redo
//     $('.patterns').css('background-image', `url(../assets/icons/${object.pattern}.svg)`)
//     $(".canvasPatterns button").removeClass('active')
//     $(`.${object.pattern}`).addClass('active')
//     currentPattern = object.pattern
// })

// // Send canvas to new user
// socket.on('get requester', requesterID => {
//     let data = {
//         data: JSON.stringify(canvas.toJSON(['name'])),
//         undo: undo_history,
//         redo: redo_history,
//         pattern: currentPattern
//     };
//     socket.emit('send board', requesterID, data)
// })