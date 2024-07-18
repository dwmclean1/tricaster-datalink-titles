import { Cue } from "./cue.js";
import { sendData, getData } from "./backend.js";


export let Cues = []
export let Config = {}
await startup()


async function startup() {
    await getConfig()
    setConfigForm()

    await loadCues()
   
    if (Cues.length > 0) {
        setUpNextStatus(getUpNext())

        const liveCue = getLiveCue()

        if (liveCue) {
            setLiveStatus(getLiveCue())
            setLiveCue(getLiveCue())
        }
        await createCueList()
    }
}


new EventSource("/status").addEventListener('message', (event) => {
    const statusBanner = document.getElementById('conn-stat')
    const navContainer = document.getElementById('nav-container')
    const sendLiveBtn = document.getElementById('send-live');
    const clearliveButton = document.getElementById('clear-live');
    const data = JSON.parse(event.data)
    console.log(data)

    if (data.connected) {
        sendLiveBtn.disabled = false
        statusBanner.textContent = `DataLink Connected`
        navContainer.classList.remove('bg-danger-subtle')
        navContainer.classList.add('bg-success-subtle')
    }
    else {
        statusBanner.textContent = 'DataLink Disconnected'
        sendLiveBtn.disabled = true
        clearliveButton.disabled = true
        navContainer.classList.remove('bg-success-subtle')
        navContainer.classList.add('bg-danger-subtle')
    }
})


document.getElementById('clear-live').addEventListener('click', async () => {
    const liveText = document.getElementById('live-text');
    const p = document.createElement('p');
    p.textContent = 'No live item.'
    liveText.replaceChildren(p);

    document.getElementById('live').classList.remove('live-cue-active');
    document.getElementById('clear-live').disabled = true;

    for (const cue of Cues) {
        if (cue.live) {
            cue.live = false
        }
    }

    await sendData('/live', JSON.stringify(Cues))
    await createCueList()
    console.log('live cue cleared');
})


// document.getElementById('edit-save').addEventListener('click', async () => {
//     const id = document.getElementById('edit-id').value
    
//     for (const cue of Cues) {
//         if (cue.id == id) {
//             if (cue.live) {
//                 const response = await getData('/live')
//                 if (response.success) {
//                     console.log('Live updated');
//                 } else { console.log('Error updating live'); }
//             }
//         } 
//     }
// })    


document.getElementById('send-live').addEventListener('click', async () => {
    let upNextCue = getUpNext()
    let liveCue = getLiveCue()

    if (upNextCue) {
        upNextCue.upNext = false
        upNextCue.live = true

        updateOrder(upNextCue, Cues.length + 1)
        setLiveCue(upNextCue)
        setLiveStatus(upNextCue)

        upNextCue = getUpNext()
        setUpNext(upNextCue)
        setUpNextStatus(upNextCue)
    }

    if (liveCue) {
        liveCue.live = false
    }

    await createCueList()

    const response = await getData('/live')
    if (response.success) {
        console.log('Live updated');
    } else { console.log('Error updating live'); }


})


export function setLiveStatus(cue) {
    if (cue) {
        const liveDiv = document.getElementById('live-text');
        const clearliveButton = document.getElementById('clear-live');

        const nameDiv = document.createElement('div');
        nameDiv.innerHTML = `<strong>Name:</strong> ${cue.name} <br> <strong>Title:</strong> ${cue.title}`;
        liveDiv.replaceChildren(nameDiv);

        document.getElementById('live').classList.add('live-cue-active');
        clearliveButton.disabled = false;

        console.log('live cue updated');
    }
}


export function getLiveCue() {
    for (const cue of Cues) {
        if (cue.live) { return cue }
    }
    return null
}


export function setLiveCue(liveCue) {
    for (const cue of Cues) {
        if (cue.id == liveCue.id) { cue.live = true }
    }
}


export function clearLiveCue() {
    for (const cue of Cues) {
        if (cue.live) {
            cue.live = false
        }
    }
}


export function getUpNext() {
    for (const cue of Cues) {
        if (cue.upNext) { return cue }
        else { return Cues[0] }
    }
}


export function setUpNext(upNextCue) {
    for (const cue of Cues) {
        if (cue.id == upNextCue.id) { cue.upNext = true }
    }
}


export function clearUpNext() {
    for (const cue of Cues) {
        if (cue.upNext) {
            cue.upNext = false
        }
    }
}


export function setUpNextStatus(cue) {
    const upNextDiv = document.getElementById('up-next');
    const sendLiveBtn = document.getElementById('send-live');
    const titleDiv = document.createElement('div');

    titleDiv.innerHTML = `<strong>Name:</strong> ${cue.name} <br> <strong>Title:</strong> ${cue.title}`;
    upNextDiv.replaceChildren(titleDiv);
    sendLiveBtn.disabled = false;

    console.log('Next Cue Updated');
}


export function updateOrder(cue, index) {
    const idx = Cues.indexOf(cue)
    Cues.splice(idx, 1)
    Cues.splice(index, 0, cue)

    let i = 0
    for (cue of Cues) {
        cue.order = i + 1
        i += 1
    }

    //     const response = await sendData('/reorder', { 'id': id, 'order': order})
    //     if (response.success) {
    //         console.log('Cue order updated');
    //     } else { console.log('Error updating cue order'); }
}


function clearLiveStatus() {
    const liveText = document.getElementById('live-text');
    const p = document.createElement('p');
    p.textContent = 'No live item.'
    liveText.replaceChildren(p);

    document.getElementById('live').classList.remove('live-cue-active');
    document.getElementById('clear-live').disabled = true;

    console.log('live cue cleared');
}


export async function createCueList() {
    const cueList = document.getElementById('cue-list');

    if (Cues) {
        const a = []

        for (const cue of Cues) {
            const cueElem = cue.createCueElem()
            a.push(cueElem)
        };

        cueList.replaceChildren(...a)

    } else {
        const div = document.createElement('div')
        const p = document.createElement('p')
        const upNextDiv = document.getElementById('up-next');

        p.textContent = "No titles"
        div.appendChild(p)
        cueList.replaceChildren(div)

        const noItems = document.createElement('p');
        noItems.textContent = 'No items in the queue.';
        upNextDiv.replaceChildren(noItems);
    }

    await sendData('/save-db', Cues)
    console.log('Cue List rebuilt')
}


async function loadCues() {
    const data = await getData('/load-db')
    Cues = []

    if (data.length > 0) {
        for (const cue of data) {
            Cues.push(new Cue(
                cue.name,
                cue.title,
                cue.type,
                cue.id,
                cue.order,
                cue.live,
                cue.upNext))
        }
    }

    console.log('Cues Loaded')
}


async function getConfig() {
    const response = await getData('/config')
    if (response.success) {
        Config = response.data
        console.log('Config Loaded')

    }
}


async function saveConfig() {
    const response = await sendData('/config', Config)
    if (response.success) {
        console.log('Config Saved')
    }
}


function setConfigForm() {
    document.getElementById('server-input').value = Config.server
    document.getElementById('share-input').value = Config.share
    document.getElementById('path-input').value = Config.file_path
    document.getElementById('user-input').value = Config.username
    document.getElementById('pass-input').value = Config.password
}