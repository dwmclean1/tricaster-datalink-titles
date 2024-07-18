import { Cues, createCueList, updateOrder, setUpNextStatus, setUpNext, getUpNext, clearUpNext } from "./script.js"
import { sendData } from "./backend.js";

export class Cue {
    constructor(name, title, type, id, order, live, upNext) {
        this.name = name;
        this.title = title;
        this.type = type;
        this.id = id;
        this.order = order;
        this.live = live != null ? live : false
        this.upNext = upNext != null ? upNext : false
        this.dragging = false;
    }

    createCueElem() {

        // Init Main Elements
        const cueItem = document.createElement('li')
        const orderNumberDiv = document.createElement('div');
        const contentDiv = document.createElement('div');
        const btnGroupDiv = document.createElement('div');

        // Cue Item
        cueItem.classList = 'list-group-item d-flex justify-content-between align-items-center draggable';
        cueItem.draggable = true

        cueItem.setAttribute('data-name', this.name)
        cueItem.setAttribute('data-title', this.title)
        cueItem.setAttribute('data-id', this.id)
        cueItem.setAttribute('data-type', this.type)

        // Order Number
        orderNumberDiv.className = 'px-4 order-number';
        orderNumberDiv.textContent = this.order;
        cueItem.appendChild(orderNumberDiv);

        // Title
        contentDiv.classList = "w-100 mx-3 no-drag"
        contentDiv.innerHTML = `<strong>Name:</strong> ${this.name} <br>
                                <strong>Title:</strong> ${this.title} <br>`;
        cueItem.appendChild(contentDiv);


        // Button Group
        btnGroupDiv.className = 'ml-auto btn-group';


        if (!this.live && this.order > 1) {
            // Up Next Button
            const upNextButton = document.createElement('button');
            upNextButton.className = 'btn btn-secondary btn-sm up-next';
            upNextButton.setAttribute('data-id', this.id)
            upNextButton.textContent = 'Up Next';
            upNextButton.addEventListener('click', async () => {
                clearUpNext(getUpNext())
                setUpNext(this)
                updateOrder(this, 0)
                setUpNextStatus(this)
                await createCueList()
            })
            btnGroupDiv.appendChild(upNextButton);
        }


        if (this.upNext) {
            cueItem.classList.add('border', 'border-success', 'border-2')
            const upNextBadge = document.createElement('span')
            upNextBadge.classList = "badge rounded-pill text-bg-warning position-absolute translate-wide"
            upNextBadge.textContent = 'Up Next'
            cueItem.appendChild(upNextBadge)
        }



        // Edit Button
        const editButton = document.createElement('button');
        editButton.className = 'btn btn-info btn-sm';
        editButton.setAttribute('data-bs-toggle', 'modal');
        editButton.setAttribute('data-bs-target', '#editModal');
        editButton.setAttribute('data-id', this.id);
        editButton.textContent = 'Edit';


        editButton.addEventListener('click', () => {
            document.getElementById('edit-id').value = cueItem.getAttribute('data-id');
            document.getElementById('edit-name').value = cueItem.getAttribute('data-name');
            document.getElementById('edit-title').value = cueItem.getAttribute('data-title');
            document.getElementById('edit-type').value = cueItem.getAttribute('data-type');

            const liveWarning = document.getElementById('live-warning')
            if (this.live) {
                liveWarning.style.display = 'block'
            } else {
                liveWarning.style.display = 'none'
            }
        })

        btnGroupDiv.appendChild(editButton);

        // Delete Button
        if (!this.live) {
            const deleteButton = document.createElement('button');
            deleteButton.className = 'btn btn-danger btn-sm';
            deleteButton.textContent = 'Delete';

            deleteButton.addEventListener('click', async () => {
                let index = 0
                for (const cue of Cues) {
                    if (this.id == cue.id) {
                        Cues.splice(index, 1)
                    }
                    index += 1
                }

                await sendData('/save-db', Cues)
                const nextCue = getUpNext()
                setUpNextStatus(nextCue)
                setUpNext(nextCue)
                await createCueList()
            })
            btnGroupDiv.appendChild(deleteButton)
        }



        if (this.live) {
            cueItem.draggable = false
            cueItem.classList.add('border', 'border-danger', 'border-2')
            const liveBadge = document.createElement('span')
            liveBadge.classList = "badge rounded-pill text-bg-danger position-absolute translate-wide"
            liveBadge.textContent = 'Live'
            cueItem.appendChild(liveBadge)
        }

        cueItem.appendChild(btnGroupDiv)

        // Event Lisenters
        cueItem.addEventListener('dragstart', (event) => {
            this.dragging = true
            console.log(`Started Drag: ${this.name}`)
            event.target.style.opacity = 0.5;
        });

        cueItem.addEventListener('dragend', async (event) => {
            console.log(`Stopped Drag: ${this.name}`)
            event.target.style.opacity = 1.0;
        });

        cueItem.addEventListener('dragover', (event) => {
            event.preventDefault();
        });

        cueItem.addEventListener('dragenter', (event) => {
            event.preventDefault();
            event.target.classList.add('over');

        });

        cueItem.addEventListener('dragleave', (event) => {
            event.preventDefault()
            event.target.classList.remove('over');
        });

        cueItem.addEventListener('drop', async (event) => {
            let draggedCue = null

            for (const cue of Cues) {
                if (cue.dragging) {
                    draggedCue = cue
                }
            }

            draggedCue.dragging = false
            event.target.classList.remove('over');
            updateOrder(draggedCue, this.order - 1)

            clearUpNext()
            setUpNext(getUpNext())
            setUpNextStatus(getUpNext())

            await createCueList()
        });

        return cueItem
    }
}