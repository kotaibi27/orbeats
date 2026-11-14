// DATA FOR THE GAME "GUESS THE YEAR".
// This is the ONLY file to edit when real NASA numbers are ready.
//
// !!! PLACEHOLDER DATA !!!
// The numbers below are NOT real measurements. They are made-up sample values that follow a
// plausible shape (night lights slowly getting brighter, lightning rising and falling with the
// seasons) so the game can be built and tested. Every dataset marked  placeholder: true  is
// announced in the game as "sample data".
//
// HOW TO SWAP IN REAL DATA
// 1. For each year, replace the list of numbers with the real values (for example 12 monthly
//    averages). Any unit works. The game scales the numbers by itself.
//    Bigger number = higher and louder note. A year with a bigger average = faster pulse.
// 2. Every year in one dataset should have the same amount of numbers.
// 3. Change  placeholder: true  to  placeholder: false.  The game then stops saying "sample data".
// 4. "title" is the name spoken and shown in the game. "svs" is the NASA SVS number, for reference.
// 5. "thing" completes the spoken fact, for example: "night lights were about 12 percent brighter in 2021 than in 2014".
//
// The catalog's Air Quality Model Runs (SVS 5533) cover only July to August 2024, so they cannot
// be used for a guess-the-year round. Add a dataset here only if it spans several years.

var GUESS_YEAR_DATA = [
  {
    svs: '5313',
    title: 'Change in Night Lights between 2012 and 2023',
    placeholder: true,
    thing: 'night lights',
    more: 'brighter', less: 'dimmer',
    hint: 'Higher and louder notes mean brighter lights at night.',
    years: {
      2012: [103.4, 103, 101.4, 100.3, 98.5, 97.9, 96.7, 97, 98.1, 100, 101.3, 102.6],
      2013: [105.7, 105.2, 104.1, 102.4, 101.1, 99.7, 99.7, 99.6, 101.2, 102.7, 103.6, 104.8],
      2014: [107.4, 107.2, 105.9, 104.5, 103, 102.1, 100.9, 101.2, 102.3, 103.9, 105.6, 107],
      2015: [110.4, 109.4, 108.7, 106.5, 104.6, 104.6, 103.9, 104.6, 104.7, 106.6, 108.1, 109.7],
      2016: [112.6, 112.4, 111.3, 108.6, 107, 106.3, 106, 105.9, 107.5, 109.6, 110.9, 112.5],
      2017: [115.4, 114.1, 112.6, 111.9, 109.7, 108.8, 108.7, 108.2, 109.7, 111.5, 113.6, 113.8],
      2018: [117.9, 117.2, 115.8, 114.3, 112, 111.5, 110.7, 110.4, 112.6, 114.1, 115.1, 116.4],
      2019: [119.9, 120.1, 118.7, 116, 115.2, 113.4, 113.3, 113.6, 114.8, 116.7, 118.6, 119.6],
      2020: [122.2, 121.8, 120.8, 118.8, 117.8, 116, 115.9, 116, 116.7, 118.8, 120.3, 122.2],
      2021: [125.7, 124.6, 123.4, 121.1, 120.3, 118.1, 118.4, 118.2, 119.9, 121.1, 122.9, 124.3],
      2022: [128.6, 127.7, 126.4, 123.8, 122.2, 120.7, 120.4, 120.8, 122.3, 124.3, 126.1, 128],
      2023: [131.2, 130.5, 128.5, 126.5, 125.5, 123.3, 123.1, 123.8, 125, 127.1, 129.3, 130.9]
    }
  },
  {
    svs: '5011',
    title: 'Lightning Events Detected from the ISS, 2017 to 2023',
    placeholder: true,
    thing: 'lightning flashes',
    more: 'more frequent', less: 'less frequent',
    hint: 'Higher and louder notes mean more lightning. The year rises and falls with the seasons.',
    years: {
      2017: [22, 26, 39, 53, 70, 85, 89, 83, 73, 54, 39, 28],
      2018: [26, 31, 41, 60, 79, 89, 95, 91, 76, 59, 42, 29],
      2019: [26, 33, 47, 63, 80, 96, 102, 96, 81, 62, 45, 32],
      2020: [23, 28, 36, 52, 70, 78, 83, 80, 69, 52, 36, 27],
      2021: [29, 32, 47, 67, 87, 102, 108, 102, 87, 69, 47, 32],
      2022: [26, 29, 42, 58, 74, 88, 92, 86, 74, 58, 41, 29],
      2023: [29, 36, 48, 70, 91, 106, 110, 107, 90, 70, 48, 34]
    }
  }
];
