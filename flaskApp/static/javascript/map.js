//Global variables
var markers = [];
var marker;
var allStations = [];
var availableStands = [];
var availableBikes = [];
var map;
var staticData;
var bikeLayer;


// popup that displays realtime information
var infowindow;

// popup that displays travel time and distance to user
var infowindow2;

//variables for direction to markers
var directionsService,directionsRenderer,selectedMarker;

//set default location
var defaultLocation;

// //user position
var userLocation;

//sets the zoom level for the initial viewing of the map
let firstTime = true;

//-----------------------------------------------------------

function initMap() {
        //setup variables to show the route to the markers
        directionsService = new google.maps.DirectionsService();
        directionsRenderer = new google.maps.DirectionsRenderer({

        // hide the autogenerated markers and polylines
            suppressMarkers: true,
            suppressBicyclingLayer: true,
        });


       //get static data for bike stations using fetch
        fetch($SCRIPT_ROOT + '/dynamic')
            .then(function (response) {
               return response.json();
               // use the static data to create dictionary
            })
            .then(function (obj) {
               staticData = obj.available;

               // set the zoom level for the first time receiving the data
               if (firstTime){

                    // set the map to be equal to the div with id "map"
                    map = new google.maps.Map(document.getElementById("map"), {
                       zoom: 14,
                       mapTypeControl: false
                    });

                    // Create the DIV to hold the control and call the bikeControl()
                    var bikeControlDiv = document.createElement('div');
                    var centerControl = new bikeControl(bikeControlDiv, map);
                    bikeControlDiv.index = 1;
                    map.controls[google.maps.ControlPosition.TOP_LEFT].push(bikeControlDiv);

                    // create an infowindow to store the dynamic data
                    infowindow = new google.maps.InfoWindow();

                    //loop through static data to create markers for the map
                    var i;

                    // marker for current position or default position
                    marker = new google.maps.Marker({
                        map: map,
                        // give the markers a title of the stop name and number
                        title: "Current Position",
                        // set the icon of the to the bike icon and scale it
                        icon: {
                           url: "/static/icons/pin.png",
                           scaledSize: new google.maps.Size(30, 30)
                        }
                    });

                    markers[0] = marker;
                    // test if user allows for their location to be known
                    if(navigator.geolocation) {
                        navigator.geolocation.getCurrentPosition(function(position) {
                            userLocation = {
                                lat: position.coords.latitude,
                                lng: position.coords.longitude
                            };
                        // set the users location as the center of the map
                        map.setCenter(userLocation);

                            const latlng = new google.maps.LatLng(userLocation.lat, userLocation.lng);
                            markers[0].setPosition(latlng);
                        }, function() {
                            //setting the coordinates for the centre of the  map
                            defaultLocation = {
                               lat: 53.348071,
                               lng: -6.268233
                           };

                           map.setCenter(defaultLocation);

                           const latlng = new google.maps.LatLng(defaultLocation.lat, defaultLocation.lng);
                           markers[0].setPosition(latlng);
                        });
                    }

                    // marker for current position or default position
                    google.maps.event.addListener(marker, 'click', (function(marker) {
                                return function() {

                                    // zoom in on the marker selected
                                    map.setZoom(14);

                                    // center selected marker
                                    map.setCenter(marker.position);

                                    // when new marker is clicked back to default
                                    if (selectedMarker) {
                                        selectedMarker.setIcon({
                                        url: icon,
                                        scaledSize: new google.maps.Size(40, 40)});
                                    }
                                    // set the icon for the marker
                                    marker.setIcon({
                                        url: "/static/icons/pin.png",
                                        scaledSize: new google.maps.Size(30, 30)});

                                    selectedMarker = marker;

                                    if(infowindow != null){
                                        infowindow.close();
                                    }

                                    if(infowindow2 != null){
                                        infowindow2.close();
                                    }

                                    if(directionsRenderer != null){
                                        directionsRenderer.setMap(null);
                                    }

                                    if(bikeLayer != null){
                                        document.getElementById("bike-text").innerHTML = 'Show Bike Layer';
                                        bikeLayer.setMap(null)
                                        bikeLayer = null;
                                    }

                                    //change css of tag elements
                                    document.getElementById("main").style.padding = "10px 0px";
                                    document.getElementById("graphs").style.display = "none";
                                    document.getElementById("pdate").value = "select date";
                                    document.getElementById("ptime").value = "select time";
                                    document.getElementById("predictionOutput").innerHTML = "";
                                }
                    })(marker, i));

                    for (i = 0; i < staticData.length; i++) {
                        // set the bike icon to blue if  status is open or grey if closed
                        var icon;
                        if (staticData[i].Station_Status === 'OPEN') {
                           icon = "/static/icons/bikeIcon.png";
                        } else {
                           icon = "/static/icons/closedIcon.png";
                        }

                        // set the position of the markers using the longitude and latitude of the station
                        marker = new google.maps.Marker({
                           position: {
                               lat: parseFloat(staticData[i].Pos_Lat),
                               lng: parseFloat(staticData[i].Pos_Lng)
                           },
                           map: map,

                           // give the markers a title of the stop name and number
                           title: staticData[i].Stop_Name,
                           station_number: staticData[i].Stop_Number.toString(),

                           // set the icon of the to the bike icon and scale it
                           icon: {
                               url: icon,
                               scaledSize: new google.maps.Size(40, 40)
                           }
                        });

                        //add each marker to markers array so they can be referred to individually
                        markers[staticData[i].Stop_Number] = marker;
                        allStations.push(marker);

                        //add the markers with available bikes to the availableBikes array
                        if (staticData[i].Available_Bikes >0){
                            availableBikes.push(marker);
                        }

                        //add the markers with available Stands to the availableStands array
                        if (staticData[i].Available_Spaces >0){
                            availableStands.push(marker);
                        }

                        // add listener to zoom to the location of the marker and display content
                        google.maps.event.addListener(marker, 'click', (function(marker, i) {
                                return function() {
                                // hide the duration infowindow and bike route if it exists
                                if(infowindow2){
                                    infowindow2.close();
                                    directionsRenderer.setMap(null);
                                }
                                    //change css of tag elements
                                    document.getElementById("main").style.padding = "0px 40px";
                                    document.getElementById("graphs").style.display = "block";

                                    // set the dropdown value to match the clicked marker
                                    document.getElementById("stops-dd").value = staticData[i].Stop_Number;

                                    //station id or station data to update the graphs
                                    updateGraphs(staticData[i].Stop_Number);

                                    // zoom in on the marker selected
                                    map.setZoom(15);

                                    // center selected marker
                                    map.setCenter(marker.position);

                                    // Change the colour and size of the marker selected and return it to normal when new marker is clicked
                                    if (selectedMarker) {
                                        if (selectedMarker.title === "Current Position"){
                                            selectedMarker.setIcon({
                                                url: "/static/icons/pin.png",
                                                scaledSize: new google.maps.Size(30, 30)});
                                        } else{
                                            selectedMarker.setIcon({
                                                url: icon,
                                                scaledSize: new google.maps.Size(40, 40)});
                                        }
                                    }

                                    marker.setIcon({
                                        url: "/static/icons/selectBike.png",
                                        scaledSize: new google.maps.Size(60, 60)});

                                    selectedMarker = marker;


                                    var last_update =parseInt(staticData[i].Last_Update)*1000;
                                    // Set the content of the info window to display the dynamic bike data
                                    infowindow.setContent(
                                        "<div id='infowindow'>" +
                                            "<span id='update' class='Infotitle'>Updated:</span> <span class='Infovalue'>" +
                                                new Date(last_update).toLocaleDateString()+ " " +
                                                new Date(last_update).toLocaleTimeString() + "</span> <br>" +
                                            "<span id='station' class='Infotitle'>Station:</span> <span class='Infovalue'>" +
                                                staticData[i].Stop_Address + "</span> <br>" +
                                            "<span id='stationID' class='Infotitle'>Station ID:</span> <span class='Infovalue'>" +
                                                staticData[i].Stop_Number.toString() +"</span> <br>" +
                                            "<span id='bikes' class='Infotitle'>Bikes:</span> <span class='Infovalue'>" +
                                                staticData[i].Available_Bikes.toString() +"</span> <br>" +
                                            "<span id='spaces' class='Infotitle'>Spaces:</span> <span class='Infovalue'>" +
                                                staticData[i].Available_Spaces.toString() +"</span> <br>" +
                                            "<span id='banking' class='Infotitle'>Banking:</span> <span class='Infovalue'>" +
                                                staticData[i].Banking +"</span> <br>" +
                                            "<span id='route'><a onclick='calculateAndDisplayRoute(directionsService, directionsRenderer" +
                                            ",userLocation,selectedMarker)' href='javascript:void(0);'>Get walking route</a></span>" +
                                        "</div>");

                                    infowindow.open(map, marker);
                                }
                              })(marker, i));
                    }
                    firstTime= false;
               }
            })
            // catch used to test if something went wrong when parsing or in the network
            .catch(function (error) {
                console.error("Difficulty fetching real-time bike data:", error);
                console.error(error);
            });

        // call the function every minute to update the information
        setTimeout(initMap,60000);
}


//-----------------------------------------------------------
// Below are the functions to hide the dynamic data depending on available bikes or stands


// This function "clicks" the station marker selected from the dropdown
// and resets the radio buttons to the ShowAllMarkers option.
function triggerMarker(stopNum){
    google.maps.event.trigger(markers[stopNum], "click");
    document.getElementById("ShowAllMarkers").click();
}

// shows or hides  all of the markers on the map
function setMapOnAll(map) {
    for (var i = 0; i < allStations.length; i++) {
        allStations[i].setMap(map);
    }
}

// Shows all of the markers currently in the array.
function showMarkers() {
    setMapOnAll(map);
}

// Hide stations where there are no available bikes.
function showAvailableBikes() {
    showBikes(map,availableBikes);
}

// Hide stations where there are no available stands.
function showAvailableStands() {
    showBikes(map,availableStands);
}

// shows all of the markers in the selected array while hiding the others not in the array
function showBikes(map,array) {
    setMapOnAll(null);
    for (var i = 0; i < array.length; i++) {
        array[i].setMap(map);
    }
}

//-----------------------------------------------------------
//function to calculate the route between user and marker
function calculateAndDisplayRoute(directionsService, directionsRenderer,userLocation,marker) {
       // check to see if user location is define otherwise use the default value
       if(userLocation == undefined){
        userLocation = defaultLocation;
       }
    directionsService.route(
        {
          origin: userLocation,
          destination: marker.position,
          travelMode: 'WALKING'
        },
        function(response, status) {
            if (status === 'OK') {
                // obtain the distance and duration data from the object
                var duration = response.routes[0].legs[0].duration.text;
                var distance = response.routes[0].legs[0].distance.text;

                // calculate the C02 emission prevented
                var c02 = 118*parseFloat(distance).toFixed(4).toString();


                // display the polyline response on the map
                directionsRenderer.setDirections(response);
                directionsRenderer.setMap(map)

                // close the main infowindows
                infowindow.close();

                //close the travel infowindow if it exists and show the route
                if(infowindow2){
                    infowindow2.close();
                    directionsRenderer.setMap(map);
                }
                // create new infowindows to display the distance and duration
                infowindow2 = new google.maps.InfoWindow();
                infowindow2.setContent(
                     "Walking Duration: " + duration + "<br>" +
                     "Walking Distance: " + distance + "<br>" +
                     "C0<sub>2</sub> Prevented: " + c02 + "g"
                );
                infowindow2.setPosition(response.routes[0].legs[0].steps[1].end_location);
                infowindow2.open(map);
          } else {
            window.alert('Directions request failed due to ' + status);
          }
        });
}
//----------------------------------------------------------------------
//function to show and hide the bike layer
function bikeControl(controlDiv, map) {

    // Set CSS for the button
    var controlUI = document.createElement('div');
    controlUI.setAttribute("id", "bike-button");
    controlUI.title = 'Click to show or hide the bicyle layer';
    controlDiv.appendChild(controlUI);

    // Set CSS for the button's text.
    var controlText = document.createElement('div');
    controlText.setAttribute("id", "bike-text");
    controlText.innerHTML = 'Show Bike Layer';
    controlUI.appendChild(controlText);

    // Setup the click event listeners: simply set the map to Chicago.
    controlUI.addEventListener('click', function() {
        // if the bike layer is showing hide it
        if (bikeLayer){
            controlText.innerHTML = 'Show Bike Layer';
            bikeLayer.setMap(null);
            bikeLayer = null;
            }

        // if bike layer hidden show it
        else{
            controlText.innerHTML = 'Hide Bike Layer';
            bikeLayer = new google.maps.BicyclingLayer();
            bikeLayer.setMap(map);
            }
  });

}

