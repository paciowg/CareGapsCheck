# CareGapsCheck

## About
The CareGapsCheck app is a demonstration of a diabetes care gap evaluation (CMS122). It was developed for and used in the HL7 May 2022 Connectathon for the [PACIO track](https://confluence.hl7.org/display/FHIR/2022-05+PACIO+Integration+of+Post-Acute+Care+IGs)

## Tech Stack
The initial app implementation is built by using React.js as the front-end web framework.

## Usage

### Running the CareGapsCheck locally
To run the CareGapsCheck locally:
1. first clone the repository (github repo) and open it in Visual Studio code. 
2. next cd into the client folder and install project dependencies using `npm install`
3. run `npm start` which starts the main development environment for the front-end client

### Using the app

#### Connect to a server and patient

Three pieces of information are needed to start:
- Data server: source information (example: [https://ohm.healthmanager.pub.aws.mitre.org/fhir/] ([MITRE open health manager](https://github.com/Open-Health-Manager/OpenHealthManager)) )
- eCQM server: care gaps evaluation engine (example: [https://ohm.healthmanager.pub.aws.mitre.org/deqm-test-server/] ([MITRE deqm-test-server](https://github.com/projecttacoma/deqm-test-server)) )
- patient id: FHIR id of the target patient (example: `P0522-v5-patientBSJ1`)

Once entered, click the `Submit` button. If successful, a table with Patient Details fetched from the data server will be displayed. 

NOTE: the diabetes care gaps requires the patient be between age 18-75, but the app currently does not check this. The care gaps engine will, so unexpected results may occur for patients with ages outside this range.

NOTE: for the Spring 2022 connectathon, we needed to use internal URLs for the data server and eCQM server to get this to work:
- [http://ohm.healthmanager.pub.aws.mitre.org:8080/fhir/]
- [http://ohm.healthmanager.pub.aws.mitre.org:3000/4_0_1/]

#### Search for Eligible Encounters

Clicking on the `Search For Eligible Encounters` button will cause the app to search for encounters that can be evaluate for diabetes care gaps. Requirements include:
- Encounter Type: must have a code from one of the codes from the first five value sets [here](https://github.com/projecttacoma/deqm-test-server/wiki/Data-Requirements-and-Submission#valueset-content). (NOTE: currently looks only for the code `185468001`)
- Linked Diagnosis: must find a diagnosis linked to the encounter with a code from this [value set](https://github.com/cqframework/ecqm-content-r4-2021/blob/master/input/vocabulary/valueset/external/valueset-2.16.840.1.113883.3.464.1003.103.12.1001.json). (NOTE: currently looks only for the code `44054006`)

When clicked, a table with encounters that fit this criteria will be displayed

#### Check Care Gaps

Within the eligible encounters table, a button to check care gaps can be clicked for a particular encounter. This will submit the information to the care gaps engine and return the results, including:
- whether gaps were detected
- if gaps were detected
    - the reason identified
    - the detail
    - a link to directly fetch the resource on which the problem was identified
