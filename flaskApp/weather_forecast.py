import requests
import pandas as pd
import time
from datetime import datetime


def getWeatherForecast(station, prediction_date, prediction_time):
    # create the time stamp using the date and time info
    timeString = str(prediction_date + " " + prediction_time)
    timestamp = time.mktime(datetime.strptime(timeString, '%d/%m/%Y %H:%M').timetuple())

    # weather api url
    url = 'http://api.openweathermap.org/data/2.5/forecast?lat=35&lon=139&appid=9da3d1abfb8e1a3677d26c96350597c3&units=metric'

    # use request to call the api and parse the json response
    response = requests.get(url)
    data = response.json()

    # create variables to store the json information
    data_list = data['list']
    temp = []
    realfeel = []
    wind_speed = []
    description = []
    times = []

    # loop through the object to retrieve the necessary weather data and place them into individual lists
    for i in range(len(data_list)):
        times.append(data_list[i]['dt'])
        temp.append(data_list[i]['main']['temp'])
        realfeel.append(data_list[i]['main']['feels_like'])
        wind_speed.append(data_list[i]['wind']['speed'])
        description.append(data_list[i]['weather'][0]['main'])

    # Append the datalists into a dictionary
    weather_data = {
        'Stop_Number': station,
        'Temperature': temp,
        'Real_Feel': realfeel,
        'Wind_Speed': wind_speed,
        'Weather_Main': description,
        'Time': times
    }
    # create a dataframe using the dictionary
    df = pd.DataFrame(weather_data)

    # find the nearest time to the timestamp
    result_index = df['Time'].sub(timestamp).abs().idxmin()
    forecast = df.iloc[result_index]

    return forecast