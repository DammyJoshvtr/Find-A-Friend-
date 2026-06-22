async function testEndpoint() {
  console.log('Testing secure connection to AWS Load Balancer...');
  try {
    const res = await fetch('https://api.fafcampus.site/posts?limit=1', {
      headers: {
        'Accept': 'application/json',
      }
    });
    console.log('Status Code:', res.status);
    const text = await res.text();
    console.log('Response Body:', text.slice(0, 1000));
  } catch (err) {
    console.error('Fetch error (SSL check):', err);
  }
}

testEndpoint();
