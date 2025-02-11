async function fetchFileData(fileName, event) {

    fileName += '.json';
    event.preventDefault();
    console.log(`Fetching data for: ${fileName}`);
    try {
        const response = await fetch(`/saved_routes/${encodeURIComponent(fileName)}`);
        if (!response.ok) {
            throw new Error(`Error fetching data for ${fileName}`);
        }
        const data = await response.json();
        displayFileData(data, fileName);
    } catch (error) {
        console.error(error);
        alert('Failed to fetch file data. Please try again.');
    }
}

function displayFileData(data, fileName) {
    const outputDiv = document.getElementById('file-data-output');

    let route_name = data.route_name;
    let node_list = data.nodes;

    console.log(node_list);

    // Clear the previous content
    outputDiv.innerHTML = `
        <h2>Route Name: ${route_name}</h2>
        <ul id="draggable-node-list"></ul>
    `;

    const listContainer = document.getElementById('draggable-node-list');

    // Create draggable items for each node
    node_list.forEach((node, index) => {
        const listItem = document.createElement('li');
        listItem.className = 'draggable-item';
        listItem.draggable = true;

        // Node name and coordinates display and edit functionality
        listItem.innerHTML = `
            <strong class="node-name">${node.name}</strong>
            <input class="name-input" type="text" style="display: none;" value="${node.name}">
            <span class="node-coords">
                ${Math.round(node.coords[0] * 10000) / 10000}, ${Math.round(node.coords[1] * 10000) / 10000}
            </span>
            <button class="edit-btn">Edit</button>
            <input class="coord-input" type="text" style="display: none;" value="${node.coords[0]}, ${node.coords[1]}">
            <button class="save-btn" style="display: none;">Save</button>
        `;

        // Add event listeners for edit and save functionality
        const editBtn = listItem.querySelector('.edit-btn');
        const saveBtn = listItem.querySelector('.save-btn');
        const nameInput = listItem.querySelector('.name-input');
        const coordInput = listItem.querySelector('.coord-input');
        const nameDisplay = listItem.querySelector('.node-name');
        const coordsDisplay = listItem.querySelector('.node-coords');

        editBtn.addEventListener('click', () => {
            // Show input fields and save button, hide edit button and displays
            nameInput.style.display = 'inline';
            coordInput.style.display = 'inline';
            saveBtn.style.display = 'inline';
            editBtn.style.display = 'none';
            nameDisplay.style.display = 'none';
            coordsDisplay.style.display = 'none';
        });

        saveBtn.addEventListener('click', () => {
            // Parse new coordinates from the input
            const newCoords = coordInput.value.split(',').map(coord => parseFloat(coord.trim()));
            const newName = nameInput.value.trim();
            if (newCoords.length === 2 && !isNaN(newCoords[0]) && !isNaN(newCoords[1]) && newName) {
                // Update node data and display
                node.coords = newCoords;
                node.name = newName;
                nameDisplay.textContent = newName;
                coordsDisplay.textContent = `${Math.round(newCoords[0] * 10000) / 10000}, ${Math.round(newCoords[1] * 10000) / 10000}`;

                // Find the index of the updated node
                const nodeIndex = index; // 'index' is already available from the forEach loop

                // Update the links array
                if (data.links) {
                    // Update the 'end' field of the link at N-1, if it exists
                    if (nodeIndex > 0 && data.links[nodeIndex - 1]) {
                        data.links[nodeIndex - 1].end[0] = newCoords[0];
                        data.links[nodeIndex - 1].end[1] = newCoords[1];
                    }
                    // Update the 'start' field of the link at N, if it exists
                    if (data.links[nodeIndex]) {
                        data.links[nodeIndex].start[0] = newCoords[0];
                        data.links[nodeIndex].start[1] = newCoords[1];
                    }
                }

                // Restore the display
                nameInput.style.display = 'none';
                coordInput.style.display = 'none';
                saveBtn.style.display = 'none';
                editBtn.style.display = 'inline';
                nameDisplay.style.display = 'inline';
                coordsDisplay.style.display = 'inline';

                // Reflect changes in the file
                saveToFile(data, fileName);
            } else {
                alert('Please enter a valid name and coordinates in the format: x, y');
            }
        });

        listContainer.appendChild(listItem);

        // Add a horizontal line after each node except the last one
        if (index < node_list.length - 1) {
            const lineContainer = document.createElement('li');
            lineContainer.className = 'draggable-line';
            lineContainer.draggable = true;
            lineContainer.style.display = 'flex';
            lineContainer.style.alignItems = 'center';
            lineContainer.style.margin = '10px 0';
            lineContainer.style.width = '130%'; // Ensure the container is wider than the nodes
            lineContainer.draggable = true;
            lineContainer.classList.add('draggable-item');
            lineContainer.classList.add('line-item');

            const line = document.createElement('hr');
            line.style.border = '3px solid black'; // Set thickness
            line.style.width = '100%'; // Line width relative to container
            line.style.margin = '0'; // Remove extra margin

            // Add text input and save button with unique class names
            const cableTypeInput = document.createElement('input');
            cableTypeInput.type = 'text';
            cableTypeInput.placeholder = 'Enter cable type';
            cableTypeInput.className = 'cable-type-input';
            cableTypeInput.style.marginLeft = '10px';
            cableTypeInput.style.flex = '1'; // Make input field stretch to take extra space

            // Set the default value from data.links
            if (data.links && data.links[index]) {
                cableTypeInput.value = data.links[index].cable_type || '';
            }

            const saveCableButton = document.createElement('button');
            saveCableButton.textContent = 'Save';
            saveCableButton.className = 'cable-type-save-btn';
            saveCableButton.style.marginLeft = '5px';

            // Add event listener to save button
            saveCableButton.addEventListener('click', () => {
                const cableType = cableTypeInput.value.trim();
                if (cableType) {
                    // Find the corresponding link in the data.links array
                    if (data.links && data.links[index]) {
                        data.links[index].cable_type = cableType;

                        // Save updated data to the file
                        saveToFile(data, fileName);
                        saveCableButton.classList.add('saved');
                        saveCableButton.classList.remove('changed');
                    } else {
                        alert('Error: No link found for this node.');
                    }
                } else {
                    alert('Please enter a valid cable type.');
                    saveCableButton.classList.remove('saved');
                }
            });
            cableTypeInput.addEventListener('change', () => {
                saveCableButton.classList.remove('saved');
                saveCableButton.classList.add('changed');
            });

            // Append elements to the line container
            lineContainer.appendChild(line);
            lineContainer.appendChild(cableTypeInput);
            lineContainer.appendChild(saveCableButton);

            // Add the line container to the list
            listContainer.appendChild(lineContainer);
        }

    });

    const actionButtonCont = document.createElement('div');
    actionButtonCont.classList.add('action-button-cont');
    outputDiv.appendChild(actionButtonCont);
    previewButton = document.createElement('button');
    previewButton.textContent = 'Preview';
    previewButton.classList.add('preview-btn');
    mapContainer = document.createElement('div');
    mapContainer.id = 'map-cont';
    mapDiv = document.createElement('div');
    mapDiv.id = 'map';
    polyline = [];
    var map;
    previewButton.addEventListener('click', () => {
        outputDiv.appendChild(mapContainer).appendChild(mapDiv);
        // Initialize the map
        map = L.map('map', {
            worldCopyJump: true // Ensure smooth map interaction across the globe
        }).setView([20, 0], 2);

        // Add a tile layer
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            noWrap: true,
            maxZoom: 18,
            minZoom: 2,
            attribution: '© OpenStreetMap contributors'
        }).addTo(map);

        // Define the bounds
        const southWest = L.latLng(-90, -180); // Bottom-left corner
        const northEast = L.latLng(90, 180);  // Top-right corner
        const bounds = L.latLngBounds(southWest, northEast);

        // Set the maximum bounds for the map
        map.setMaxBounds(bounds);

        // Prevent users from panning outside the bounds
        map.on('drag', function () {
            map.panInsideBounds(bounds, { animate: false });
        });

        const coordinates = node_list.map(node => [node.coords[1], node.coords[0]]); // Lat, Lng
        console.log(coordinates);
        polyline = L.polyline(coordinates, { color: 'blue' }).addTo(map);
        map.fitBounds(polyline.getBounds());

    });
    actionButtonCont.appendChild(previewButton);

    reloadButton = document.createElement('div');
    reloadButton.textContent = 'Reload';
    reloadButton.classList.add('reload-btn');
    reloadButton.addEventListener('click', () => {
        polyline.remove();
        const newCoordinates = node_list.map(node => [node.coords[1], node.coords[0]]); // Lat, Lng
        polyline = L.polyline(newCoordinates, { color: 'blue' }).addTo(map);
        map.fitBounds(polyline.getBounds());
        reloadButton.classList.toggle('reloading');
    });
    mapContainer.appendChild(reloadButton);

    const doneButton = document.createElement('button');
    doneButton.textContent = 'Done';
    doneButton.classList.add('done-btn');
    doneButton.addEventListener('click', () => {
        // Iterate through each save button and trigger a click event
        //saveCableButton.forEach(button => {
        //    button.click();
        //});
        const isConfirmed = confirm('Did you save all the changes?');
            if (isConfirmed) {
                // Clear the previous content
                outputDiv.innerHTML = ``;
            }
            else {
                return;
            }
    });
    actionButtonCont.appendChild(doneButton);
    const addBtnCont = document.createElement('div');
    addBtnCont.classList.add('add-btn-cont');
    const addButton = document.createElement('button');
    addButton.textContent = 'Add waypoint';
    addButton.classList.add('add-btn');
    addButton.addEventListener('click', () => {
        const nodeName = prompt('Enter node name:');
        const nodeCoords = prompt('Enter node coordinates (format: x, y):');
        if (nodeName && nodeCoords) {
            const coordsArray = nodeCoords.split(',').map(coord => parseFloat(coord.trim()));
            if (coordsArray.length === 2 && !isNaN(coordsArray[0]) && !isNaN(coordsArray[1])) {
                const newNode = {
                    name: nodeName,
                    coords: coordsArray
                };
                node_list.push(newNode);

                if (node_list.length > 1) {
                    const prevNode = node_list[node_list.length - 2];
                    const newLink = {
                        start: prevNode.coords,
                        end: newNode.coords,
                        cable_type: ''
                    };
                    if (!data.links) {
                        data.links = [];
                    }
                    data.links.push(newLink);
                }

                displayFileData(data, fileName);
                saveToFile(data, fileName);
            } else {
                alert('Please enter valid coordinates in the format: x, y');
            }
        } else {
            alert('Please enter both node name and coordinates.');
        }
    });
    listContainer.appendChild(addBtnCont).appendChild(addButton);

    // Add drag-and-drop functionality
    let draggedItem = null;

    listContainer.addEventListener('dragstart', (e) => {
        if (e.target && (e.target.classList.contains('draggable-item') || e.target.classList.contains('draggable-line'))) {
            draggedItem = e.target;
            e.target.classList.add('dragging');
        }
    });

    listContainer.addEventListener('dragend', (e) => {
        if (e.target && (e.target.classList.contains('draggable-item') || e.target.classList.contains('draggable-line'))) {
            e.target.classList.remove('dragging');

            // Update the node_list order based on the new DOM structure
            const reorderedNodes = [];
            const nodeElements = Array.from(listContainer.querySelectorAll('.draggable-item'));

            // Use the node_list array for accurate data, mapping DOM elements to node_list indices
            nodeElements.forEach((element) => {
                const nodeNameElement = element.querySelector('.node-name');
                if (!nodeNameElement) {
                    return;
                }

                const nodeName = nodeNameElement.textContent;

                // Find the corresponding node in the original node_list
                const nodeData = node_list.find(node => node.name === nodeName);

                if (nodeData) {
                    reorderedNodes.push(nodeData);
                }
            });

            // Rebuild links based on the reordered nodes, preserving depth
            const reorderedLinks = [];
            for (let i = 0; i < reorderedNodes.length - 1; i++) {
                const startNode = reorderedNodes[i];
                const endNode = reorderedNodes[i + 1];

                // Preserve depth if it exists
                const originalLink = data.links && data.links[i];
                const startDepth = originalLink?.start[2] ?? startNode.coords[2] ?? 0; // Default depth to 0 if not present
                const endDepth = originalLink?.end[2] ?? endNode.coords[2] ?? 0; // Default depth to 0 if not present

                reorderedLinks.push({
                    start: [startNode.coords[0], startNode.coords[1], startDepth],
                    end: [endNode.coords[0], endNode.coords[1], endDepth],
                    distance: data.links[i].distance,
                    cable_type: originalLink?.cable_type || ''
                });
            }

            // Replace the old node_list and links with the reordered ones
            data.nodes = reorderedNodes;
            data.links = reorderedLinks;

            // Save the updated data back to the file
            saveToFile(data, fileName);
        }
    });

    listContainer.addEventListener('dragover', (e) => {
        e.preventDefault();
        const afterElement = getDragAfterElement(listContainer, e.clientY);
        if (afterElement == null) {
            listContainer.appendChild(draggedItem);
        } else {
            listContainer.insertBefore(draggedItem, afterElement);
        }
    });

    function getDragAfterElement(container, y) {
        const draggableElements = [...container.querySelectorAll('.draggable-item:not(.dragging), .draggable-line:not(.dragging)')];

        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;
            if (offset < 0 && offset > closest.offset) {
                return { offset: offset, element: child };
            } else {
                return closest;
            }
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    }

    // Function to save updated data back to the file
    function saveToFile(updatedData, fileName) {
        // Example: Use an API or server endpoint to save the file
        fetch(`/saved_routes/${fileName}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(updatedData),
        })
            .then(response => {
                if (!response.ok) {
                    throw new Error('Failed to save file');
                }
            })
            .catch(error => {
                console.error('Error saving file:', error);
                alert('Error saving file. Please try again.');
            });
    }
}
