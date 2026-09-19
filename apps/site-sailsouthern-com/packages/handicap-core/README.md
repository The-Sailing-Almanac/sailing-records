# `@stax/handicap-core`

A lightweight, dependency-free core library containing pure functions to perform sailboat racing handicapping calculations.

## Formulae

### PHRF Time-On-Distance (ToD)
Corrects the elapsed time based on course distance:
$$\text{Corrected Time} = \text{Elapsed Time} - (\text{PHRF Rating} \times \text{Distance})$$

### PHRF Time-On-Time (ToT)
Corrects the elapsed time based on a Time Correction Factor (TCF):
$$\text{TCF} = \frac{A}{B + \text{PHRF}}$$
$$\text{Corrected Time} = \text{Elapsed Time} \times \text{TCF}$$
*Default coefficients: $A = 650$, $B = 550$.*

### Portsmouth Yardstick
Corrects the elapsed time using a percentage-based Yardstick number ($HC$):
$$\text{Corrected Time} = \frac{\text{Elapsed Time} \times 100}{HC}$$

## API

### Functions
* `scorePhrfTod(elapsedTimeSeconds, ratingSecPerMile, distanceMiles)`: Returns PHRF ToD corrected time.
* `calculatePhrfTcf(phrfRating, A, B)`: Calculates the TCF factor.
* `scorePhrfTot(elapsedTimeSeconds, phrfRatingOrTcf, isTcf, A, B)`: Returns PHRF ToT corrected time.
* `scorePortsmouth(elapsedTimeSeconds, portsmouthHc)`: Returns Portsmouth corrected time.
* `scoreRace(system, results, options)`: Scores and ranks a list of results.
