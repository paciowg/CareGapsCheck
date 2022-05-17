import React, { useState, useEffect } from 'react';
import { Table, Container, Row, Col, Button } from "react-bootstrap";
import { useForm } from 'react-hook-form';
import axios from "axios";
import "./CareGapsCheck.css"; // Import styling
import FHIR from "fhirclient"
import { type } from '@testing-library/user-event/dist/type';

<script src="./node_module/fhirclient/build/fhir-client.js"></script>

function CareGapsCheck() {
    
    const { register, handleSubmit, formState: { errors } } = useForm({
        mode: 'onTouched',
    });

    const [patientData, setPatientData] = useState([]);
    const [encounterData, setEncounterData] = useState(null);
    const [careGaps, setCareGaps] = useState(null);
    const [eCQMServer, setECQMServer] = useState('');
    const [patientId, setPatientId] = useState('');
    const [fhirServer, setFhirServer] = useState('');
    const [encounterId, setEncounterId] = useState('');

    const onSubmit = async (data) => {
        console.log(data)
        const patientId = data.patientId
        setPatientId(patientId)
        const server = data.server
        setFhirServer(server)
        const eCQMServer = data.ecqmEndpoint
        setECQMServer(eCQMServer)
        const client = FHIR.client(server);
        setPatientData([])
        setEncounterData(null)
        setCareGaps(null)
        setEncounterId('')
        
        client.request("Patient/" + patientId)
            .then(setPatientData)
            .catch(display); 
    }

    const getEncounters = async () => {
        console.log("getting auditable encounters") 
        
        const client = FHIR.client(fhirServer);
        
        client.request("Encounter?patient=" + patientId)
            .then( encounterResults => {
                const dxCheckPromises = encounterResults.entry.map( async entry => {
                    return client.request("Condition?encounter=" + entry.resource.id)
                })
                Promise.all(dxCheckPromises)
                    .then(dxCheck => {
                        const eligibleEncounters = []
                        dxCheck.map( (dxSearchSet, encIndex) => {
                            const typeOk = checkEncounterType(encounterResults.entry[encIndex].resource)
                            const dxOk = checkDiganosis(dxSearchSet)
                            if (typeOk && dxOk) {
                                console.log("here")
                                eligibleEncounters[eligibleEncounters.length] = encounterResults.entry[encIndex].resource
                            }

                        })
                        console.log(eligibleEncounters)
                        
                        setEncounterData(eligibleEncounters)
                    })
            })


               
    }

    function checkEncounterType(encounterResource) {
        var toReturn = false
        encounterResource.type.map( type => {
            type.coding.map(code => {
                if (code.code === "185468001") {
                    console.log("type match " + encounterResource.id)
                    toReturn = true
                }
            })
        })

        return toReturn
    }

    function checkDiganosis(searchSetBundle) {
        var toReturn = false
        console.log(searchSetBundle)
        if (searchSetBundle.total == 0) {
            return false
        }
        searchSetBundle.entry.map( entry => {
            entry.resource.code.coding.map( code => {
                if (code.code === "44054006") {
                    toReturn = true
                }
            })
        })

        return toReturn
    }

    const checkCareGaps = async (encounterResource) => {
        console.log("running care gaps report")
        setEncounterId(encounterResource.id) 

        const client = FHIR.client(fhirServer);
        
        client.request(encounterResource.subject.reference)
        .then( patientResource => {
            client.request("Condition?encounter=" + encounterResource.id)
            .then( conditionBundle => {
                client.request("Observation?encounter=" + encounterResource.id + "&code=17856-6")
                .then( observationBundle => {
                    const resourceList = []
                    resourceList[0] = patientResource
                    resourceList[1] = encounterResource
                    if (conditionBundle.total > 0) {
                        conditionBundle.entry.map(entry => {
                            resourceList[resourceList.length] = entry.resource
                        })
                    }
                    if (observationBundle.total > 0) {
                        observationBundle.entry.map(entry => {
                            resourceList[resourceList.length] = entry.resource
                        })
                    }
                    doCareGaps(resourceList)
                })
            })
        })
    }

    function doCareGaps(resourceList) {
        console.log(eCQMServer)
        const client = FHIR.client(eCQMServer);
        
        const dataPackage = {
            resourceType: "Parameters",
            parameter: [{
                name: "measureReport",
                resource: {
                  resourceType: "MeasureReport",
                  status: "complete",
                  type: "data-collection",
                  measure: "http://ecqi.healthit.gov/ecqms/Measure/DiabetesHemoglobinA1cHbA1cPoorControl9FHIR",
                  period: {
                    start: "2021-01-01",
                    end: "2022-01-01"
                  }
                }
            }]
        }
        resourceList.map(resource => {
            const entry = {
                name: "resource",
                resource: resource
            }
            dataPackage.parameter[dataPackage.parameter.length] = entry
        })
        console.log(dataPackage)
        client.request({
                url: "/Measure/$submit-data",
                method: "POST",
                body: JSON.stringify(dataPackage),
                headers: {
                    "Content-Type": "application/fhir+json"
                }
                })
            .then( response => {
                console.log(response)

                if (response.resourceType == "Bundle") {
                    const gapPatientId = response.entry[1].response.location.split("/").pop()
                    client.request("Measure/$care-gaps?periodStart=2021-01-01&periodEnd=2022-01-01&status=open-gap&measureId=DiabetesHemoglobinA1cHbA1cPoorControl9FHIR&subject=Patient/" + gapPatientId)
                    .then( gapResponse => {
                        console.log(gapResponse)
                        setCareGaps(extractCareGapsResult(gapResponse))
                    })
                }


        })

    }

    function extractCareGapsResult(gapResponse) {
        var isGap = "No"
        var theReason = ""
        var theLink = ""
        var thePath = ""
        var theReasonDetail = ""
        if (gapResponse.parameter.length > 0) {
            if (gapResponse.parameter[0].resource.entry.length == 4) {
                isGap = "Yes"
                const detectedIssue = gapResponse.parameter[0].resource.entry[3].resource
                const guidanceResponse = detectedIssue.contained[0]
                theReason = guidanceResponse.reasonCode[0].coding[0].display
                var theLink = ""
                var thePath = ""
                var theReasonDetail = ""
                console.log(guidanceResponse)
                guidanceResponse.reasonCode[0].coding[0].extension[0].extension.map( ext => {
                    if (ext.url == "reference") {
                        theLink = eCQMServer + ext.valueReference.reference
                    }
                    else if (ext.url == "path") {
                        thePath = ext.valueString
                    }
                })

                if (thePath != "") {
                    // get details from data requirements
                    guidanceResponse.dataRequirement[0].extension.map( ext => {
                        console.log(ext)
                        if ((ext.url == "http://hl7.org/fhir/us/cqfmeasures/StructureDefinition/cqfm-valueFilter")
                        && (ext.extension[0].valueString == thePath)) {
                            theReasonDetail = "Field '" + thePath + "' is '" + ext.extension[1].valueCode + "' than '" + ext.extension[2].valueQuantity.value + ext.extension[2].valueQuantity.unit + "'"
                        }
                    })
                }
            }
        }

        return {
            gap: isGap,
            reason: theReason,
            detail: theReasonDetail,
            link: theLink
        }
    }

    Date.prototype.addDays = function(days) {
        var date = new Date(this.valueOf());
        date.setDate(date.getDate() + days);
        return date;
    }

    /*

    const getSupportingInfo = async (ciReference) => {
        
        const client = FHIR.client(fhirServer);
        client.request(ciReference)
            .then( clinicalImpression => {
                console.log(clinicalImpression)
                setSupportingClinicalImpression(clinicalImpression)
            })
            .catch(console.log)
    }
            
*/
    function display(data) {
        const output = document.getElementById("output");
        output.innerText = data instanceof Error ?
            String(data) :
            JSON.stringify(data, null, 4);
    }

    function getName(patientData) {
        if (patientData.name[0]) {
            if (patientData.name[0].text) {
                return patientData.name[0].text
            }
            else {
                return patientData.name[0].family + patientData.name[0].given[0]
            }                         
        }
        return ""
    }

    return (
        <Container fluid className="content-block">
            <Row style={{ paddingTop: "20px" }}>
                <Col md={6}>
                    <h1>eCQM Care Gaps</h1>
                    <form onSubmit={handleSubmit(onSubmit)}>
                        <h3>Data Server: </h3><input type="text" className="form-control" {...register("server", { required: true })} />
                        {errors.server && <p className="error-text">fhir server is required</p>}
                        <h3>eCQM Server: </h3><input type="text" className="form-control" {...register("ecqmEndpoint", { required: true })} />
                        {errors.ecqmEndpoint && <p className="error-text">ecqmEndpoint fhir server is required</p>}
                        <h3>Patient Id: </h3><input type="text" className="form-control" {...register("patientId", { required: true })} />
                        {errors.patientId && <p className="error-text">patientId required</p>}
                        <Button variant='form' type="submit">Submit</Button>
                    </form>
                </Col>
            </Row>
            <div id="output"/>
            {patientData?.id &&
                <Row>
                    <Col md={6}>
                        <h2 style={{ paddingTop: "30px" }}>Patient Details</h2>

                        <Table striped bordered hover variant="dark" responsive="lg">
                            <thead>
                                <tr>
                                    <th>Patient</th>
                                    <th>Name</th>
                                    <th>Dob</th>
                                    <th>Link</th>
                                </tr>
                            </thead>
                            <tbody>
                                    <tr className="tableList" key="0">
                                        <td>{patientData.id}</td>
                                        <td>{getName(patientData)}</td>
                                        <td>{new Date(patientData.birthDate).toLocaleString()}</td>
                                        <td><a href={fhirServer + "Patient/" + patientData.id}>{fhirServer + "Patient/" + patientData.id}</a></td>
                                    </tr>
                            </tbody>
                        </Table>
                        <Button variant='form' onClick={() => getEncounters()}>Search for Eligible Encounters</Button>
                    </Col>
                    
                </Row>
                
            }
            {(encounterData != null) &&
                <Row>
                    <Col md={6}>
                        <h2 style={{ paddingTop: "30px" }}>Encounters</h2>

                        <Table striped bordered hover variant="dark" responsive="lg">
                            <thead>
                                <tr>
                                    <th>id</th>
                                    <th>Start</th>
                                    <th>End</th>
                                    <th>Check</th>
                                    <th>Link</th>
                                </tr>
                            </thead>
                            <tbody>
                                {encounterData.map((resource, index) => (
                                        <tr className="tableList" key={index}>
                                        <td>{resource.id}</td>
                                        <td>{new Date(resource.period.start).toLocaleString()}</td>
                                        <td>{new Date(resource.period.end).toLocaleString()}</td>
                                        <td><Button variant='form' onClick={() => checkCareGaps(resource)}>Check for Care Gaps</Button></td>
                                        <td><a href={fhirServer + "Encounter/" + resource.id}>{fhirServer + "Encounter/" + resource.id}</a></td>
                                    </tr>
                                ))}
                            </tbody>
                        </Table>

                    </Col>
                </Row>
            }
            {(careGaps != null) &&
                <Row>
                    <Col md={6}>
                        <h2 style={{ paddingTop: "30px" }}>{"Care Gaps Result for encounter " + encounterId}</h2>

                        <Table striped bordered hover variant="dark" responsive="lg">
                            <thead>
                                <tr>
                                    <th>Gaps?</th>
                                    <th>Reason</th>
                                    <th>Detail</th>
                                    <th>Link</th>
                                </tr>
                            </thead>
                            <tbody>
                                        <tr className="tableList" key="0">
                                        <td>{careGaps.gap}</td>
                                        <td>{careGaps.reason}</td>
                                        <td>{careGaps.detail}</td>
                                        <td>{careGaps.link}</td>
                                    </tr>
                            </tbody>
                        </Table>

                    </Col>
                </Row>
            }
            
        </Container>
    )
}

export default CareGapsCheck;

