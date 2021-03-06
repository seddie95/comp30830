import requests
from flask import Flask, g, jsonify, render_template, request, url_for
from sqlalchemy import create_engine
from sqlalchemy.exc import OperationalError
from logging import FileHandler, WARNING
from prediction_api import makePrediction
from weather_forecast import getWeatherForecast
from getCurrentWeather import getCurrentWeather
import config as c
from flask_caching import Cache


app = Flask(__name__)
# Check Configuring Flask-Caching section for more details
cache = Cache(app, config={'CACHE_TYPE': 'simple'})


# call function to get weather forecast and store result as cache for 3 hours
@cache.memoize(timeout=1800)
def get_weather_forecast():
    return getWeatherForecast()


# Create errorlog text-file to store all the non http errors
if not app.debug:
    file_handler = FileHandler('errorlog.txt')
    file_handler.setLevel(WARNING)
    app.logger.addHandler(file_handler)


# function that connects to the RDS database using the credentials
def connect_to_database():
    # Create engine and take credentials
    engine = create_engine("mysql+mysqldb://{}:{}@{}/{}".format(c.user, c.password, c.host, c.db_name))
    return engine


# function that gets the database if it exists
def get_db():
    db = getattr(g, '_database', None)
    if db is None:
        db = g._database = connect_to_database()
    return db


# Route for the home page that renders the base.html template
# gets the static data from the rds to populate the drop downs
# cache the static data for a full day
@app.route('/')
@cache.cached(timeout=86400)
def base():
    if not request.script_root:
        # this assumes that the 'index' view function handles the path '/'
        request.script_root = url_for('base', _external=True)

    """Function to retrieve the static data from the database and return it as either json or pass it to the
    html using jinja for the purpose of displaying the map data."""
    # call the function get_db to connect to the database and store the response in a list
    try:
        engine = get_db()
        datalist = []
        # sql query that returns all of the static information form the RDS database
        rows = engine.execute("SELECT * FROM BikeStatic;")
        # for loop appends the rows to dictionary which will be inserted into the list datalist
        for row in rows:
            datalist.append(dict(row))

        # if the datalist list is not empty it will render the template base.html and pass it the function datalist
        # the datalist function will be used with jinja to populate the dropdown lists
        if datalist:
            return render_template('index.html', datalist=datalist)
        else:
            noStatic = "Error: No static data was found "
            return render_template('index.html', noStatic=noStatic)

    # return a message to the user stating that an issue exists connecting to the database
    except OperationalError:
        return '<h1> Problem connecting to the Database:</h1>' \
               '<br><h2>Please sit tight and we will resolve this issue</h2>' \
               '<br> <a href="/">Home</a>'


# route for providing the dynamic information for a given station id cache the result for 50 seconds
@app.route("/dynamic")
@cache.cached(timeout=50)
def get_stations():
    try:
        # Create the engine and store the output in the data list
        engine = get_db()
        data = []

        # The SQL retrieves the latest dynamic data and joins it with the static data to get station info
        SQLquery = """SELECT dd.Stop_Number, dd.Bike_Stands, dd.Available_Spaces,
                            dd.Available_Bikes, dd.Station_Status, dd.Last_Update,
                            sd.Stop_Address, sd.Banking, sd.Pos_Lat, sd.Pos_Lng
                            FROM comp30830.BikeDynamic as dd,comp30830.BikeStatic as sd
                            WHERE dd.Stop_Number = sd.Stop_Number AND (dd.Stop_Number,dd.Last_Update) IN
                                    (SELECT Stop_Number as SN, MAX(Last_Update) as LU
                                    FROM comp30830.BikeDynamic
                                    GROUP BY Stop_Number
                                    ORDER BY Last_Update desc);"""

        rows = engine.execute(SQLquery)
        # append the contents to a dictionary so it can be jsonified
        for row in rows:
            data.append(dict(row))

        # test to see if the station is in the database by seeing if returned dictionary is empty
        if data:
            return jsonify(available=data)
        else:
            return '<h1>Station ID not found in Database</h1>'

    # OperationError states that the database does not exist this will be shown to the user
    except OperationalError:
        return '<h1> Problem connecting to the Database:</h1>' \
               '<br><h2>Please sit tight and we will resolve this issue</h2>' \
               '<br> <a href="/">Home</a>'


# route for providing the graph data, cache result for 30 minutes
@app.route("/WeeklyGraph")
@cache.cached(timeout=1800)
def get_weeklyGraphData():
    try:
        # Create  the engine and store the data in the data list
        engine = get_db()
        data = []
        timeData = "%H:%i"

        # SQL will select all the
        SQLquery = """SELECT Stop_Number,
                            CONVERT(avg(Available_Spaces),char) as Available_Spaces,
                            CONVERT(avg(Available_Bikes),char) as Available_Bikes,
                            DAYNAME(FROM_UNIXTIME(last_update)) AS Weekday 
                        FROM comp30830.BikeDynamic 
                        WHERE 
                            from_unixtime(Last_Update, %s) <= '00:30' OR 
                            from_unixtime(Last_Update, %s) >= '05:30'
                        GROUP BY Stop_Number,Weekday
                        ORDER BY Stop_Number asc, WEEKDAY(from_unixtime(Last_Update)) asc;"""
        rows = engine.execute(SQLquery, [timeData, timeData])

        for row in rows:
            data.append(dict(row))

        # test to see if the station is in the database by seeing if returned dictionary is empty
        if data:
            return jsonify(available=data)
        else:
            return '<h1>Weekly Data not found in Database</h1>'

    # OperationError states that the database does not exist The below message will be shown to user
    except OperationalError:
        return '<h1> Problem connecting to the Database:</h1>' \
               '<br><h2>Please sit tight and we will resolve this issue</h2>' \
               '<br> <a href="/">Home</a>'


# route for providing the graph data, cache result for 30 minutes
@app.route("/HourlyGraph")
@cache.cached(timeout=1800)
def get_hourlyGraphData():
    try:
        # Create  the engine and store the data in the data list
        engine = get_db()
        data = []

        timeData = "%H:%i"
        weekData = "%W"
        hourData = "%H"

        SQLquery = """SELECT Stop_Number, DAYNAME(FROM_UNIXTIME(last_update)) as Weekday,
                            from_unixtime(Last_Update, %s) as Hours,
                            CONVERT(avg(Available_Bikes),char) as AvgBike,
                            CONVERT(avg(Available_Spaces),char) as AvgSpace
                        FROM comp30830.BikeDynamic
                        WHERE
                            from_unixtime(Last_Update, %s) <= '00:30' OR
                            from_unixtime(Last_Update, %s) >= '05:30'
                        GROUP BY
                            Stop_Number,
                            from_unixtime(Last_Update, %s),
                            from_unixtime(Last_Update, %s)
                        ORDER BY
                            Stop_Number asc,
                            WEEKDAY(from_unixtime(Last_Update)) asc,
                            Hours asc;"""

        rows = engine.execute(SQLquery, [hourData, timeData, timeData, weekData, hourData])

        for row in rows:
            data.append(dict(row))

        # test to see if the station is in the database by seeing if returned dictionary is empty
        if data:
            return jsonify(available=data)
        else:
            return '<h1>Hourly Data not found in Database</h1>'

    # OperationError states that the database does not exist the below message will be returned to the user
    except OperationalError:
        return '<h1> Problem connecting to the Database:</h1>' \
               '<br><h2>Please sit tight and we will resolve this issue</h2>' \
               '<br> <a href="/">Home</a>'


# route for providing the weather data, cache result for 5 minutes
@app.route("/weather")
@cache.cached(timeout=300)
def get_currentWeather():
    try:
        # Obtain the current weather for Dublin
        return getCurrentWeather()

    # Return None if there is difficulties connecting to the weather api
    except requests.exceptions.ConnectionError:
        return None


# get the prediction data from the forms to be used as input for predictive model
# and return the predicted value in json format
@app.route('/predict')
def get_PredictedData():
    try:
        # The station date and time will be taken from the link and then put into the model for prediction
        station = request.args.get('station')
        pDate = request.args.get('date')
        pTime = request.args.get('time')

        # Obtain the  weather forecast for Dublin
        weather_data = getWeatherForecast()

        # pass the station, date, time and weather information into the prediction script
        prediction = makePrediction(weather_data, station, pDate, pTime)
        return jsonify(predictions=prediction)

    # Return None if there is difficulty connecting to the weather api
    except requests.exceptions.ConnectionError:
        return None


# error handling for page not found
@app.errorhandler(404)
def page_not_found(e):
    # The below web-page will be shown if the web-page does not exist
    return render_template('404.html')


# Server error
@app.errorhandler(500)
def server_error(e):
    # This web-page will be rendered if their is an issue connecting to the server.
    return render_template('500.html')


if __name__ == "__main__":
    app.run(debug=True, port=80, host="172.31.82.72")
