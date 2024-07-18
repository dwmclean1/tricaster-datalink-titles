export async function sendData(url, data) {
    const request = new Request(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
    });

    try {
        console.log(`Data Sent: ${JSON.stringify(data)}`)
        const response = await fetch(request);
        if (!response.ok) {
            throw new Error(`Response status: ${response.status}`);
        } else { return await response.json()}

    } catch (error) {
        console.error(error.message);
    }
}


export async function getData(url) {
    const request = new Request(url, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json'
        }
    });

    try {
        const response = await fetch(request);
        if (!response.ok) {
            throw new Error(`Response status: ${response.status}`);
        }
        const json = await response.json();
        console.log(`Data Received: ${JSON.stringify(json)}`)
        return json
    } catch (error) {
        console.error(error.message);
    }
}