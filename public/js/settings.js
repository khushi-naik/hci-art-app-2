// Default brush settings
let boardMode = 'pen'
let widthOption = 4
let colorOption = '#000'

// Change tool
function changeAction(target) {
    ['pointer', 'eraser', 'pen'].forEach(action => {
        const t = document.getElementById(action);
        t.classList.remove('active')
    })
    if (typeof target === 'string') target = document.getElementById(target)
    target.classList.add('active')
    switch (target.id) {
        case "pointer":
            boardMode = 'pointer'
            applyDraggable()
            break
        case "eraser":
            boardMode = 'eraser'
            color.style.pointerEvents = 'none'
            color.style.opacity = 0.2
            break
        case "pen":
            boardMode = 'pen'
            color.style.pointerEvents = 'auto'
            color.style.opacity = 1
            break
        default:
            break
    }
}

// Brush settings
function setBrush(option) {
    // Width settings
    if (option.width !== undefined) {
        widthOption = option.width
        document.querySelector('#sizes button.active').classList.remove('active')
    }
    if (option.width == 3) {
        size.style.backgroundSize = '50%'
        small.classList.add('active')
    } else if (option.width == 4) {
        size.style.backgroundSize = '76%'
        middle.classList.add('active')
    } else if (option.width == 5) {
        size.style.backgroundSize = '110%'
        big.classList.add('active')
    }

    // Color settings
    if (option.color !== undefined) {
        let val = option.color
        colorOption = val
        color.style.backgroundColor = val
    }
}
colorInput.onchange = function () {
    setBrush({ color: colorInput.value })
}

// Set canvas pattern
let currentPattern = 'none'
function setPattern(name) {
    background.style.backgroundImage = `url(../assets/patterns/pattern_${name}.svg)`
    pattern.style.backgroundImage = `url(../assets/icons/${name}.svg)`
    document.querySelector('#patterns button.active').classList.remove('active')
    document.getElementById(name).classList.add('active')
    currentPattern = name
};
setPattern('none')