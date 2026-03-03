import autocannon from 'autocannon';

const body = JSON.stringify({
    type: 'page_view',
    timestamp: new Date().toISOString(),
    payload: { url: '/home' },
});

const instance = autocannon({
    url: 'http://localhost:3000/v1/events',
    method: 'POST',
    headers: {
        'content-type': 'application/json',
        'x-api-key': 'dev-key-1',
    },
    body,
    connections: 100,
    duration: 10,
    title: 'Analytics Gateway Load Test',
});

// Print live progress to terminal
autocannon.track(instance, { renderProgressBar: true });

instance.on('done', (result) => {
    console.log('\n--- Results ---');
    console.log(`Requests/sec:  avg=${result.requests.average}  max=${result.requests.max}`);
    console.log(`Latency (ms):  avg=${result.latency.average}  p99=${result.latency.p99}`);
    console.log(`2xx responses: ${result['2xx']}`);
    console.log(`Non-2xx:       ${result.non2xx}`);
    console.log(`Errors:        ${result.errors}`);
});

