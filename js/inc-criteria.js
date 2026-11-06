// Internal Non-Conformance (INC) criteria and control limits
// Source: QA-INC-001 Rev 01 (QA INC Criteria & Limits.pdf, 2026-11-05)
// Keys are the parameter names in lower case, so they match the report table headers.
const INC_CRITERIA = {
  // 1. Food Safety & Quality Control
  'continuous vent cutting': { section: 'Food Safety & Quality Control', expected: 'Yes', deviation: 'Critical: Intestines cut or ruptured, resulting in fecal contamination on the meat or inside the cavity.' },
  'ensure cavitty removal': { section: 'Food Safety & Quality Control', expected: 'Yes', deviation: 'Major: Lungs, kidneys, or other organs remaining inside the cavity exceeding the acceptable percentage.' },
  'ensure cavity removal': { section: 'Food Safety & Quality Control', expected: 'Yes', deviation: 'Major: Lungs, kidneys, or other organs remaining inside the cavity exceeding the acceptable percentage.' },
  'gizzard temp': { section: 'Food Safety & Quality Control', expected: '<4 C', deviation: 'Critical: Core temperature of gizzards failing to drop below 4°C within the specified time.' },
  'liver temp': { section: 'Food Safety & Quality Control', expected: '<4 C', deviation: 'Critical: Core temperature of livers failing to drop below 4°C within the specified time.' },
  'water supply slaughter': { section: 'Food Safety & Quality Control', expected: 'Yes', deviation: 'Major: Disruption of water supply or low water pressure hindering the cleaning processes during operation.' },
  'scalder tank temp': { section: 'Food Safety & Quality Control', expected: '56-59 C', deviation: 'Major: Temperature deviating from limits causing skin tearing or poor feather removal.' },
  'washing points ev': { section: 'Food Safety & Quality Control', expected: '11 Points', deviation: 'Major: Blocked nozzles or low water pressure resulting in inadequate washing (less than 11 points active).' },
  'cl 7am': { section: 'Food Safety & Quality Control', expected: '30 ppm', deviation: 'Critical: Chlorine level deviating from the 30 ppm limit during the morning check.' },
  'cl 1pm': { section: 'Food Safety & Quality Control', expected: '30 ppm', deviation: 'Critical: Chlorine level deviating from the 30 ppm limit during the afternoon check.' },

  // Same parameter, spelt as in the report header
  'continous vent cutting': { section: 'Food Safety & Quality Control', expected: 'Yes', deviation: 'Critical: Intestines cut or ruptured, resulting in fecal contamination on the meat or inside the cavity.' },

  // 2. Operational & GMP Control
  'labour position gap slaughter': { section: 'Operational & GMP Control', expected: 'No', deviation: 'Major/Minor: Absence of labor at critical points in the slaughter division disrupting the process flow.' },
  'labour position gap ev': { section: 'Operational & GMP Control', expected: 'No', deviation: 'Major/Minor: Absence of labor at critical points in the evisceration division disrupting the process flow.' },

  // 3. Environmental & Utility Control (ETP / Waste Water)
  'ph level': { section: 'Environmental & Utility Control', expected: '6.8-8.5', deviation: 'Major: Discharge water pH level dropping below 6.8 or exceeding 8.5.' },
  'chlorine': { section: 'Environmental & Utility Control', expected: '<0.1', deviation: 'Major: Discharge water chlorine level exceeding 0.1 ppm (environmental hazard).' },
  'parabolic screen cleanness': { section: 'Environmental & Utility Control', expected: 'No', deviation: 'Minor: Blocked screen due to lack of cleaning, preventing proper water filtration.' },
  'colour': { section: 'Environmental & Utility Control', expected: 'Good', deviation: 'Major: Water becoming discolored or visually unacceptable.' },
  'smell': { section: 'Environmental & Utility Control', expected: 'Good', deviation: 'Major: Water emitting a strong, unacceptable odor.' },
  'solid waste bucket': { section: 'Environmental & Utility Control', expected: '<=8', deviation: 'Minor: Solid waste bucket count/volume exceeding the limit of 8.' },
  'chemical dosing': { section: 'Environmental & Utility Control', expected: 'Yes', deviation: 'Major: Failure in continuous or correct chemical dosing into the system.' },
  'leakage m1': { section: 'Environmental & Utility Control', expected: 'No', deviation: 'Minor: Water or material leakages from pump/motor 1 (M1).' },
  'leakage m2': { section: 'Environmental & Utility Control', expected: 'No', deviation: 'Minor: Water or material leakages from pump/motor 2 (M2).' },
  'backwash sand bed': { section: 'Environmental & Utility Control', expected: 'Yes', deviation: 'Major: System blockage due to failure to perform sand bed backwash.' },
  'backwash clarifier': { section: 'Environmental & Utility Control', expected: 'Good', deviation: 'Major: Clarifier backwash condition deteriorating or not performed adequately.' }
};
