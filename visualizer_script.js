// Initialize the map
const map = L.map('map', {
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

// Array to store previously generated colors
const generatedColors = ["#ffffff"];

// Function to generate a random hexadecimal color
function getRandomColor() {
    let isDistinct = false;
    let newColor;

    while (!isDistinct) {
        // Generate random red, green, and blue values (200 instead of 255 for more pastel colors)
        const r = Math.floor(Math.random() * 200);
        const g = Math.floor(Math.random() * 200);
        const b = Math.floor(Math.random() * 200);

        // Convert to hexadecimal format
        newColor = rgbToHex(r, g, b);

        // Check if the new color is distinct enough
        isDistinct = generatedColors.every((color) => {
            return calculateColorDifference(color, newColor) > 1; // Minimum difference threshold
        });
    }

    // Save the new color and return it
    generatedColors.push(newColor);
    console.log(generatedColors);
    return newColor;
}

// Function to convert RGB values to hexadecimal format
function rgbToHex(r, g, b) {
    return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

// Function to calculate the difference between two hexadecimal colors
function calculateColorDifference(hex1, hex2) {
    const [r1, g1, b1] = hexToRgb(hex1);
    const [r2, g2, b2] = hexToRgb(hex2);

    // Calculate Euclidean distance in RGB space
    return Math.sqrt(
        Math.pow(r2 - r1, 2) +
        Math.pow(g2 - g1, 2) +
        Math.pow(b2 - b1, 2)
    );
}

// Function to convert a hexadecimal color to RGB values
function hexToRgb(hex) {
    const bigint = parseInt(hex.slice(1), 16);
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;
    return [r, g, b];
}

// Store polyline data for crossing detection
const polylinesData = []; // Array to store all polylines
const polylineMap = {}; // Object to store references to polylines
eezFeatures = []; // Store EEZ features for crossings detection
var routeCount = 0; // Counter for the number of routes
var zoneCrossCount = 0; // Counter for the number of zone crossings
var cableCrossCount = 0; // Counter for the number of cable crossings

//const jsonFiles = ['test1.json', 'test2.json', 'test3.json', 'test4.json'];
//const jsonFiles = ['test1.json', 'test2.json', 'test3.json', 'test4.json', 'test5.json', 'test6.json', 'test7.json', 'test8.json', 'test9.json', 'test10.json'];

const jsonFiles = [];

async function fetchFiles() {
    try {
        const response = await fetch('/saved_routes');
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        const data = await response.json();
        if (data.files && Array.isArray(data.files)) {
            const fullPaths = data.files.map(file => `/saved_routes/${file}`);
            jsonFiles.push(...fullPaths);
        } else {
            console.error('Invalid response format:', data);
        }
    } catch (error) {
        console.error('Error fetching files:', error);
    }
}

// Call the function
fetchFiles().then(() => {
    console.log('Fetched files:', jsonFiles);

    jsonFiles.forEach(file => {
        fetch(file)
            .then(response => response.json())
            .then(data => {
                const links = data.links || [];
                const coordinates = data.nodes.map(node => [node.coords[1], node.coords[0]]); // Lat, Lng
                const color = getRandomColor();
                const routeName = data.route_name;
                

                // Check if the polyline crosses the antimeridian
                const isCrossing = crossesAntimeridian(coordinates);
                //console.log(isCrossing);
                // Log the result or update UI accordingly
                if (isCrossing) {
                    console.log(`${data.route_name} crosses the Antimeridian`);
                
                    // Split the polyline at the antimeridian
                    let [group1, group2] = splitCoordinatesAtMeridian(coordinates);

                    // Determine the split index for links (same as polyline split index)
                    const splitIndex = group1.length;

                    // Split the links array at the same index
                    const linksGroup1 = links.slice(0, splitIndex - 1); // Exclude the split point
                    const linksGroup2 = links.slice(splitIndex - 2);

                    group1.push([isCrossing, 180]);
                    group2.unshift([isCrossing, -180]);
                
                    // Add the split polylines to the map as separate routes
                    const routeNamePart1 = `${data.route_name}_part1`;
                    const routeNamePart2 = `${data.route_name}_part2`;
                
                    const polyline1 = L.polyline(group1, { color: color }).addTo(map);
                    const polyline2 = L.polyline(group2, { color: color }).addTo(map);
                
                    // Save references to each part with their new names
                    polylineMap[routeNamePart1] = polyline1;
                    polylineMap[routeNamePart2] = polyline2;
                
                    // Save each part as separate entries in polylinesData
                    polylinesData.push({
                        name: routeNamePart1,
                        coordinates: group1,
                        color: color,
                        links: links
                    });
                
                    polylinesData.push({
                        name: routeNamePart2,
                        coordinates: group2,
                        color: color,
                        links: links
                    });
                
                    // Create separate UI elements for each part
                    createRouteDiv(routeNamePart1, color, linksGroup1, group1);
                    createRouteDiv(routeNamePart2, color, linksGroup2, group2);
                    return;
                
                } else {
                    console.log(`${data.route_name} does not cross the Antimeridian`);
                
                    // Add the single polyline to the map
                    const polyline = L.polyline(coordinates, { color: color }).addTo(map);
                
                    // Save the polyline reference
                    polylineMap[data.route_name] = polyline;
                
                    // Save polyline data for crossings detection
                    polylinesData.push({
                        name: data.route_name,
                        coordinates,
                        color: color,
                        links: links
                    });
                
                    // Create UI element for the route
                    createRouteDiv(routeName, color, links, coordinates)
                }

                // Check for crossings after adding the new polyline
                checkAllCrossings();
            })
            .catch(error => console.error(`Error loading JSON file ${file}:`, error));
    });
});

function crossesAntimeridian(coordinates) {
    for (let i = 0; i < coordinates.length - 1; i++) {
        const [lat1, lon1] = coordinates[i];
        const [lat2, lon2] = coordinates[i + 1];

        // Check for anti-meridian crossing
        if (Math.abs(lon2 - lon1) > 180) {
            const wrapLon = lon1 > 0 ? 180 : -180;
            const ratio = (wrapLon - lon1) / (lon2 - lon1);
            const crossingLat = lat1 + ratio * (lat2 - lat1);

            // Log the crossing latitude if needed
            //console.log(crossingLat);

            // Return true if crossing occurs
            return crossingLat;
        }
    }

    // Return false if no crossing happens after the loop
    return false;
}

function createRouteDiv(routeName, color, groupLinks, coordinates) {
    const links = groupLinks || [];
    const routeDiv = document.createElement('div');
    routeDiv.id = routeName;
    routeDiv.classList.add('routes');
    routeDiv.style.background = color;
    routeCount++;

    // Add route name to the div
    const routeNameSpan = document.createElement('span');
    routeNameSpan.innerText = routeName;
    routeDiv.appendChild(routeNameSpan);

    // Add a "Toggle Route" button
    const toggleButton = document.createElement('button');
    toggleButton.innerText = ' ';
    toggleButton.style.backgroundImage = eyeOpenImg;
    toggleButton.style.border = 'none';
    toggleButton.style.cursor = 'pointer';
    toggleButton.classList.add('shown');

    // Track visibility state and segment lines
    let isRouteVisible = true;
    const segmentLines = []; // Store all segment lines for this route

    // Add popups and store segment lines
    for (let i = 0; i < coordinates.length - 1; i++) {
        const start = coordinates[i];
        const end = coordinates[i + 1];

        // Display the corresponding link in a popup at the midpoint
        const linkContent = groupLinks[i] || "No data available for this segment";
        const linkStart = groupLinks[i]?.start || "Unknown";
        const linkStartDepth = Math.round(100 *linkStart[2]) / 100 || 'Unknown';
        const linkEnd = groupLinks[i]?.end || "Unknown";
        const linkEndDepth = Math.round(100 *linkEnd[2]) / 100 || 'Unknown';
        const linkDistance = Math.round(10000 * groupLinks[i]?.distance) / 10000 || "Unknown";
        const linkType = groupLinks[i]?.cable_type || "Unknown";

        // Create a polyline for the segment
        const segmentLine = L.polyline([start, end], { color: color, weight: 2 }).addTo(map);
        segmentLine.bindPopup(
            `<strong><span style="color:${color}">${routeName}</span> Segment ${i + 1}</strong><br>Start: <br>&nbsp;Lon: ${linkStart[0]}<br>&nbsp;Lat: ${linkStart[1]}<br>&nbsp;Depth: ${linkStartDepth} m<br>End: <br>&nbsp;Lon: ${linkEnd[0]}<br>&nbsp;Lat: ${linkEnd[1]}<br>&nbsp;Depth: ${linkEndDepth} m<br> Length: ${linkDistance} km<br>Cable type: ${linkType}`
        ).on('click', () => {
            segmentLine.openPopup();
        });

        // Store the segment line for toggling
        segmentLines.push(segmentLine);
    }

    // Add click event to the toggle button
    toggleButton.addEventListener('click', () => {
        const polyline = polylineMap[routeName];
        if (polyline) {
            if (isRouteVisible) {
                // Hide the route polyline and segment lines
                map.removeLayer(polyline);
                segmentLines.forEach((line) => map.removeLayer(line));
                toggleButton.classList.remove('shown');
                toggleButton.classList.add('hidden');
    
                // Remove highlighted zones for this route
                if (highlightedZones[routeName]) {
                    highlightedZones[routeName].forEach((zone) => map.removeLayer(zone.layer));
                    highlightedZones[routeName] = []; // Clear the record for this route
                }
    
                toggleButton.innerText = ' '; // Update button text
                toggleButton.style.backgroundImage = eyeClosedImg;
            } else {
                // Show the route polyline and segment lines
                polyline.addTo(map);
                segmentLines.forEach((line) => line.addTo(map));
                toggleButton.classList.add('shown');
                toggleButton.classList.remove('hidden');
    
                // Highlight zones for this route only
                const polylineData = polylinesData.find((data) => data.name === routeName);
                if (polylineData) {
                    const correctedCoordinates = polylineData.coordinates.map(([lat, lng]) => [lng, lat]);
                    const polylineFeature = turf.lineString(correctedCoordinates);
    
                    eezFeatures.forEach((zone) => {
                        try {
                            const zoneBoundary = turf.polygonToLine(zone);
                            const intersections = turf.lineIntersect(polylineFeature, zoneBoundary);
    
                            if (intersections.features.length > 0) {
                                const validIntersections = intersections.features.filter((point) =>
                                    turf.booleanPointInPolygon(point, zone)
                                );
    
                                if (validIntersections.length > 0) {
                                    const zoneLayer = L.geoJSON(zone, {
                                        style: {
                                            color: polylineData.color,
                                            weight: 2,
                                            fillOpacity: 0.3,
                                        },
                                    }).addTo(map);
    
                                    // Track the highlighted zone for this route
                                    highlightedZones[routeName].push({
                                        layer: zoneLayer,
                                        feature: zone,
                                    });
                                }
                            }
                        } catch (error) {
                            console.error(`Error processing zone:`, error);
                        }
                    });
                }
    
                toggleButton.innerHTML = ' '; // Update button text
                toggleButton.style.backgroundImage = eyeOpenImg;
            }
            isRouteVisible = !isRouteVisible; // Toggle visibility state
        }
    });

    routeDiv.appendChild(toggleButton);

    // Add click event to zoom in on the corresponding polyline
    routeNameSpan.addEventListener('click', () => {
        const polyline = polylineMap[routeName];
        if (polyline && isRouteVisible) {
            polyline.bringToFront();
            map.fitBounds(polyline.getBounds());
            filterCrossings(routeName);
        }
        const linksContainer = document.getElementById('links-container');
        linksContainer.classList.add('active');
        linksContainer.classList.remove('hidden');
        linksContainer.innerHTML = `<strong class="title">Links in ${routeName}:</strong>`;
        const resetFilterDiv = document.createElement('div');
        resetFilterDiv.classList.add('reset-filter');
        resetFilterDiv.innerText = ' ';
        resetFilterDiv.style.backgroundImage = resetImg;
        resetFilterDiv.addEventListener('click', resetFilterCrossings);
        const hideSpan = document.createElement('span');
        hideSpan.classList.add('active');
        hideSpan.style.backgroundImage = arrowDownImg;
        hideSpan.innerText = '';
        linksContainer.append(hideSpan);
        linksContainer.appendChild(resetFilterDiv);
        if (links.length > 0) {
            links.forEach((link, index) => {
                const linkStart = link?.start || 'Unknown';
                const linkStartDepth = Math.round(100 *link?.start[2]) / 100 || 'Unknown';
                const linkEnd = link?.end || 'Unknown';
                const linkEndDepth = Math.round(100 *link?.end[2]) / 100 || 'Unknown';
                const linkDistance = Math.round(10000 * link?.distance) / 10000 || 'Unknown';
                const linkType = link?.cable_type || 'Unknown';
                const linkInfo = document.createElement('div');
                linkInfo.classList.add('link-info');
                linkInfo.style.background = color;
                linkInfo.innerHTML = `
                    <strong class="segment">Segment ${index + 1}:</strong><br>
                    Start: Start: <br>&nbsp;Lon: ${linkStart[0]}<br>&nbsp;Lat: ${linkStart[1]}<br>&nbsp;Depth: ${linkStartDepth} m<br>
                    End: Start: <br>&nbsp;Lon: ${linkEnd[0]}<br>&nbsp;Lat: ${linkEnd[1]}<br>&nbsp;Depth: ${linkEndDepth} m<br> 
                    Length: ${linkDistance} km<br>
                    Cable type: ${linkType}`;
                linkInfo.addEventListener('click', () => {
                    const start = coordinates[index];
                    const end = coordinates[index + 1];
                    const segmentBounds = L.latLngBounds([start, end]);
                    map.fitBounds(segmentBounds);
                });

                linksContainer.appendChild(linkInfo);
            });
        } else {
            linksContainer.innerHTML += 'No links available for this route.';
        }
        hideSpan.addEventListener('click', () => {
            hideSpan.classList.toggle('active');
            linksContainer.classList.toggle('collapse');
        });
    });

    // Append the div to the container
    document.getElementById('route-cont-inner').appendChild(routeDiv);
}

function filterCrossings(routeName) {
    if (typeof routeName !== 'string') {
        console.error('Invalid routeName:', routeName);
        return;
    }

    const elements = document.querySelectorAll('.crossing-info');
    elements.forEach(crossingInfo => {
        const text = crossingInfo.textContent.toLowerCase();
        if (text.includes(routeName.toLowerCase())) {
            crossingInfo.style.display = 'block';
            console.log("includes");
        } else {
            crossingInfo.style.display = 'none';
            console.log("does not include");
        }
    });

    // Update the counters
    filteredcableCross = Array.prototype.slice.call(document.querySelectorAll('.crossing-info.cableCrossing')).filter(function(el) {
        return el.style.display === 'block';
    }).length;
    document.getElementById('cableCrossCounter').innerText = filteredcableCross;

    filteredzoneCross = Array.prototype.slice.call(document.querySelectorAll('.crossing-info.zoneCrossing')).filter(function(el) {
        return el.style.display === 'block';
    }).length;
    document.getElementById('zoneCrossCounter').innerText = filteredzoneCross;
}

function resetFilterCrossings() {
    filterCrossings("_");
    document.getElementById('links-container').classList.remove('active');
    document.getElementById('links-container').classList.remove('collapse');
    document.getElementById('links-container').classList.add('hidden');
    map.setView([20, 0], 2);
}


function toggleAllRoutesVisibility() {
    var element = document.getElementById("toggleCablesVisibility");
    element.classList.toggle("shown");
    element.classList.toggle("hidden");
    filterCrossings("Crossing");
    var toggleButtons;

    if (element.classList.contains("shown")) {
        toggleButtons = document.querySelectorAll('.routes button.shown');
        element.style.backgroundImage = eyeClosedImg;
    }
    if (element.classList.contains("hidden")) {
        // Select all route toggle buttons
        toggleButtons = document.querySelectorAll('.routes button.hidden');
        element.style.backgroundImage = eyeOpenImg;
    }

    // Iterate through each button and trigger a click event
    toggleButtons.forEach(button => {
        button.click();
    });
}

// Function to check for crossings between all polylines
function checkAllCrossings() {
    // Clear previous crossings display
    const crossingsDiv = document.getElementById("crossings-inner");
    //crossingsDiv.classList.add("initial");

    // Compare every pair of polylines
    for (let i = 0; i < polylinesData.length; i++) {
        for (let j = i + 1; j < polylinesData.length; j++) {
            const poly1 = polylinesData[i];
            const poly2 = polylinesData[j];
            detectCrossings(
                poly1.coordinates,
                poly1.name,
                poly1.color,
                poly2.coordinates,
                poly2.name,
                poly2.color
            );
        }
    }

    if (crossingsDiv.length === 0) {
        crossingsDiv.innerHTML = '<div class="title">No cable crossing detected.</div>';
    }
}

// Function to detect crossings between two sets of coordinates
function detectCrossings(coord1, routeName1, routeColor1, coord2, routeName2, routeColor2) {
    // Convert coordinate arrays to Turf.js LineString features
    const line1 = turf.lineString(coord1);
    const line2 = turf.lineString(coord2);

    // Use Turf.js to find intersection points
    const intersections = turf.lineIntersect(line1, line2);

    // If intersections are found, display them in the 'crossings' div
    if (intersections.features.length > 0) {
        intersections.features.forEach((feature) => {
            const [latitude, longitude] = feature.geometry.coordinates;
            const crossingDiv = document.createElement('div');
            crossingDiv.classList.add("crossing-info");
            crossingDiv.classList.add("cableCrossing");
            crossingDiv.innerHTML = `
                <strong>Crossing Point:</strong> (${latitude.toFixed(6)}, ${longitude.toFixed(6)})<br>
                <strong>Routes:</strong> <span style="color: ${routeColor1}">${routeName1}</span> & <span style="color: ${routeColor2}">${routeName2}</span> 
            `;
            crossingDiv.addEventListener('click', () => {
                map.setView([latitude, longitude], 10); // Zoom to the crossing point
            });
            cableCrossCount++;
            document.getElementById("crossings-inner").appendChild(crossingDiv);
        });
    }
}



fetch('https://raw.githubusercontent.com/lmirosevic/ReverseGeo/master/lib/reverse_geo/World-EEZ.geojson')
    .then(response => response.json())
    .then(eezData => {
        // Ensure the properties are retained when converting the GeoJSON features
        eezFeatures = eezData.features.map(zone => {
            if (zone.geometry && zone.geometry.type === "Polygon") {
                zone.geometry.coordinates = zone.geometry.coordinates.map(ring =>
                    ring.map(coord => [coord[0], coord[1]]) // Ensure [longitude, latitude] order
                );
            } else if (zone.geometry && zone.geometry.type === "MultiPolygon") {
                zone.geometry.coordinates = zone.geometry.coordinates.map(polygon =>
                    polygon.map(ring => ring.map(coord => [coord[0], coord[1]]))
                );
            }
            // Ensure the zone object is returned with both geometry and properties
            return zone;
        });

        // Call highlightCrossedZones after all polylines are added
        highlightCrossedZones();
    })
    .catch(error => console.error('Error loading EEZ data:', error));


const highlightedZones = {}; // Store highlighted zones for each route

// Function to check and highlight crossed zones
function highlightCrossedZones() {
    Object.keys(polylineMap).forEach((routeName) => {
        const polyline = polylineMap[routeName];

        // Skip hidden routes
        if (!map.hasLayer(polyline)) {
            return;
        }

        const polylineData = polylinesData.find((data) => data.name === routeName);
        if (!polylineData) return;

        const correctedCoordinates = polylineData.coordinates.map(([lat, lng]) => [lng, lat]);
        const polylineFeature = turf.lineString(correctedCoordinates);

        // Initialize an array for this route if not already present
        if (!highlightedZones[routeName]) {
            highlightedZones[routeName] = [];
        }

        eezFeatures.forEach((zone) => {
            try {
                const zoneBoundary = turf.polygonToLine(zone);
                const intersections = turf.lineIntersect(polylineFeature, zoneBoundary);

                if (intersections.features.length > 0) {
                    const validIntersections = intersections.features.filter((point) =>
                        turf.booleanPointInPolygon(point, zone)
                    );

                    if (validIntersections.length > 0) {
                        // Check if the zone is already highlighted
                        if (
                            highlightedZones[routeName].some(
                                (existingZone) => existingZone.feature === zone
                            )
                        ) {
                            return;
                        }

                        const zoneLayer = L.geoJSON(zone, {
                            style: {
                                color: polylineData.color,
                                weight: 2,
                                fillOpacity: 0.3,
                            },
                        }).addTo(map);

                        // Store the zone layer
                        highlightedZones[routeName].push({
                            layer: zoneLayer,
                            feature: zone,
                        });

                        // Update the control panel
                        validIntersections.forEach((point) => {
                            const [longitude, latitude] = point.geometry.coordinates;
                            const crossingDiv = document.createElement('div');
                            crossingDiv.classList.add('crossing-info');
                            crossingDiv.classList.add('zoneCrossing');
                            crossingDiv.innerHTML = `
                                <strong>Crossing Zone</strong><br>
                                <strong>Route:</strong> ${routeName}<br>
                                <strong>Country:</strong> ${zone.properties?.ISO_A3 || 'Unknown'}<br>
                                <strong>Coordinates:</strong> (${latitude.toFixed(6)}, ${longitude.toFixed(6)})<br>
                            `;
                            crossingDiv.addEventListener('click', () => {
                                map.setView([latitude, longitude], 5); // Zoom in on the crossing
                            });

                            zoneCrossCount++;

                            document.getElementById('EEZcrossings-inner').appendChild(crossingDiv);
                        });
                    }
                }
            } catch (error) {
                console.error(`Error processing zone:`, error);
            }
        });
    });
}




//Load EEZs
function showEEZs () {
    fetch('https://raw.githubusercontent.com/lmirosevic/ReverseGeo/master/lib/reverse_geo/World-EEZ.geojson')
    .then(response => response.json())
    .then(data => {
        eezLayer = L.geoJSON(data, {
            style: {
                color: 'blue',
                weight: 1,
                fillOpacity: 0.1                                
            }
        }).addTo(map);
    });
}
function hideEEZs () {
    map.removeLayer(eezLayer);
}

function toggleZones() {
    if (document.getElementById("toggleZones").classList.contains("active")) {
        hideEEZs();
        document.getElementById("toggleZones").classList.remove("active");
        return
    }
    if (!document.getElementById("toggleZones").classList.contains("active")) {
        showEEZs();
        document.getElementById("toggleZones").classList.add("active");
        return
    }
}

function hideZoneCross() {
    var element = document.getElementById("EEZcrossings");
    element.classList.toggle("active");
    document.getElementById("hideZoneCross").classList.toggle("active");
    highlightCrossedZones();
  }

function hideCableCross() {
    var element = document.getElementById("crossings");
    element.classList.toggle("active");
    document.getElementById("hideCableCross").classList.toggle("active");
    checkAllCrossings();
  }
  
function splitCoordinatesAtMeridian(coordinates) {
    let group1 = [];
    let group2 = [];
  
    for (let i = 0; i < coordinates.length - 1; i++) {
      group1.push(coordinates[i]);
  
      // Check if the longitude difference crosses the 180-degree meridian
      let currentLongitude = coordinates[i][1];
      let nextLongitude = coordinates[i + 1][1];
      
      if (Math.abs(currentLongitude - nextLongitude) > 180) {
        // Split occurs here
        group2 = coordinates.slice(i + 1);
        break;
      }
    }
  
    return [group1, group2];
  }


function shortenRouteCont(){
    document.getElementById('routeCounter').innerText = routeCount;
    if (routeCount > 8) {
        const hideButton = document.createElement('div');
        hideButton.id = 'shortenList';
        hideButton.classList.add('active');
        hideButton.style.backgroundImage = arrowDownImg;
        hideButton.style.cursor = 'pointer';
        document.getElementById('route-cont').appendChild(hideButton);
        document.getElementById('route-cont').classList.add('shorten');
        hideButton.addEventListener('click', () => {
            document.getElementById('route-cont').classList.toggle('open');
            hideButton.classList.toggle('active');
        });
    }
}

function shortenZoneCrossingCont(){
    document.getElementById('zoneCrossCounter').innerText = zoneCrossCount;
    if (zoneCrossCount > 3) {
        const hideButton = document.createElement('div');
        hideButton.id = 'shortenZoneCrossList';
        hideButton.classList.add('active');
        hideButton.style.backgroundImage = arrowDownImg;
        hideButton.style.cursor = 'pointer';
        document.getElementById('EEZcrossings').appendChild(hideButton);
        document.getElementById('EEZcrossings').classList.add('shorten');
        hideButton.addEventListener('click', () => {
            document.getElementById('EEZcrossings').classList.toggle('open');
            hideButton.classList.toggle('active');
        });
    }
}

function shortenCableCrossingCont(){
    document.getElementById('cableCrossCounter').innerText = cableCrossCount;
    if (cableCrossCount > 3) {
        const hideButton = document.createElement('div');
        hideButton.id = 'shortenCableCrossList';
        hideButton.classList.add('active');
        hideButton.style.backgroundImage = arrowDownImg;
        hideButton.style.cursor = 'pointer';
        document.getElementById('crossings').appendChild(hideButton);
        document.getElementById('crossings').classList.add('shorten');
        hideButton.addEventListener('click', () => {
            document.getElementById('crossings').classList.toggle('open');
            hideButton.classList.toggle('active');
        });
    }
}
  
const eyeClosedImg = "url(data:image/jpeg;base64,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)";

const eyeOpenImg = "url(data:image/jpeg;base64,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)";

const arrowDownImg = "url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgBAMAAACBVGfHAAAAA3NCSVQICAjb4U/gAAAACXBIWXMAAAD7AAAA+wFieMcIAAAAGXRFWHRTb2Z0d2FyZQB3d3cuaW5rc2NhcGUub3Jnm+48GgAAADBQTFRF////AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAL92gewAAAA90Uk5TAAQJCjtpdY+Wvb7Q1ub03SA7hAAAAIBJREFUKFO9ysENQEAQheGHg6sSlOCqBkWoQKIDHbgoQAku+nBTgwZEiOTZrDU724B3mfyTD/hnuY4YqLbCd9LPmDj4R8kLC08hycgbNT0pyR0phRjAFuiEGHCYI8QBTxwQIuAjAhxR4CUKvEQDSzSwJACWaGBJAIBmDRtRhj/3AGM8XAuNLZoTAAAAAElFTkSuQmCC)";

const resetImg = "url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABgAAAAYCAYAAADgdz34AAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAAAsQAAALEBxi1JjQAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAAC6SURBVEiJrdWxDsIgFEbho49UB3xi09n4PMahMV00ah+gLhBJpO2F+zORDudrCVCACzACAd0IsXkmTmbgJUJCbM3AHaADHhlydMQPwJPCCyuQxbgC2Yx7EHO8BamO1yDNcQvijq8hsngJmYCPMp4j7xhOkCm+NwI747Omka/5xO9LvNfKXzytuezuWtstbsSyFZuRmn1ejbQcIjPiOaGbiOL4LyLKu6WI3ETxNPKf/hWgBwZRPEcG4PQF4/SMwLqJC6IAAAAASUVORK5CYII=)";

document.getElementById("toggleCablesVisibility").style.backgroundImage = eyeOpenImg;