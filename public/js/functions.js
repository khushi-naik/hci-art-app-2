function clearBoard() {
    board.style.transform = `scale(0.8)`
    board.style.opacity = 0
    setTimeout(() => {
        scene.innerHTML = ''
        board.style.opacity = 1
        board.style.transform = `scale(1)`
    }, 150)
}
document.addEventListener('keydown', function(event) {
    if (event.code == 'Delete') {
        clearBoard()
    }
})

document.addEventListener('keydown', function(event) {
    if (event.code == 'KeyC' && (event.ctrlKey || event.metaKey)) {
        copyLink()
    }
})

function addImage(event) {
    let image = document.createElementNS('http://www.w3.org/2000/svg','image')
    let imageUrl = URL.createObjectURL(event.target.files[0])
    let imageData = document.createElement("img")
    imageData.onload = function(){
        let position_x = board.width.baseVal.value.toFixed(0)/2/transformScale - imageData.width/2/transformScale - transformX/transformScale
        let position_y = board.height.baseVal.value.toFixed(0)/2/transformScale - imageData.height/2/transformScale - transformY/transformScale
        image.setAttributeNS(null,'width',imageData.width/transformScale)
        image.setAttributeNS(null,'height',imageData.height/transformScale)
        image.setAttributeNS('http://www.w3.org/1999/xlink','href',imageUrl)
        image.setAttributeNS(null,'x',position_x)
        image.setAttributeNS(null,'y',position_y)
        scene.append(image)
        emitObject(image)
        file.value = ''
    }
    imageData.src = imageUrl
}

function scrollSize(event) {
    if (event.deltaY < 0) {
        if (widthOption == 3) {
            document.querySelector('#sizes button.active').classList.remove('active')
            size.style.backgroundSize = '76%'
            middle.classList.add('active')
            widthOption = 4
        } else if (widthOption == 4) {
            document.querySelector('#sizes button.active').classList.remove('active')
            size.style.backgroundSize = '110%'
            big.classList.add('active')
            widthOption = 5
        }
    } else if (event.deltaY > 0) {
        if (widthOption == 5) {
            document.querySelector('#sizes button.active').classList.remove('active')
            size.style.backgroundSize = '76%'
            middle.classList.add('active')
            widthOption = 4
        } else if (widthOption == 4) {
            document.querySelector('#sizes button.active').classList.remove('active')
            size.style.backgroundSize = '50%'
            small.classList.add('active')
            widthOption = 3
        }
    }
}

function scrollColor(event) {
    if (event.deltaY < 0) {
        if (colorOption == '#000') {
            setBrush({ color: '#d01919' })
        } else if (colorOption == '#d01919') {
            setBrush({ color: '#eaae00' })
        } else if (colorOption == '#eaae00') {
            setBrush({ color: '#16ab39' })
        } else if (colorOption == '#16ab39') {
            setBrush({ color: '#1678c2' })
        }
    } else if (event.deltaY > 0) {
        if (colorOption == '#1678c2') {
            setBrush({ color: '#16ab39' })
        } else if (colorOption == '#16ab39') {
            setBrush({ color: '#eaae00' })
        } else if (colorOption == '#eaae00') {
            setBrush({ color: '#d01919' })
        } else if (colorOption == '#d01919') {
            setBrush({ color: '#000' })
        }
    }
}

function scrollPattern(event) {
    if (event.deltaY < 0) {
        if (currentPattern == 'none') {
            setPattern('sq')
            sendCommand('sq')
        } else if (currentPattern == 'sq') {
            setPattern('line')
            sendCommand('line')
        } else if (currentPattern == 'line') {
            setPattern('dot')
            sendCommand('dot')
        }
    } else if (event.deltaY > 0) {
        if (currentPattern == 'dot') {
            setPattern('line')
            sendCommand('line')
        } else if (currentPattern == 'line') {
            setPattern('sq')
            sendCommand('sq')
        } else if (currentPattern == 'sq') {
            setPattern('none')
            sendCommand('none')
        }
    }
}

function copyLink() {
    navigator.clipboard.writeText(window.location.href)
        .then(() => {
            // Получилось!
        })
        .catch(err => {
            console.log('Something went wrong', err)
        })
}

const fadeIn = (cl, timeout) => {
    let element = document.querySelector(cl)
    element.style.opacity = 0
    element.style.display = 'flex'
    element.style.transition = `opacity ${timeout}ms`
    setTimeout(() => {
        element.style.opacity = 1
    }, 10)
}

const fadeOut = (cl, timeout) => {
    let element = document.querySelector(cl)
    element.style.opacity = 1
    element.style.transition = `opacity ${timeout}ms`
    element.style.opacity = 0

    setTimeout(() => {
        element.style.display = 'none'
    }, timeout)
}