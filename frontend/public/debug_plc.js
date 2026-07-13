setTimeout(async () => {
  const token = localStorage.getItem('token');
  if (!token) {
    console.log('No token found');
    return;
  }
  
  console.log('=== Testing PLC Device State API ===');
  
  try {
    const response = await fetch('http://localhost:3001/api/devices/modbus-192-168-124-137-502-1/state', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await response.json();
    console.log('PLC State Response:', JSON.stringify(data, null, 2));
    console.log('Has power property:', 'power' in data);
    console.log('Power value:', data.power, 'typeof:', typeof data.power);
    console.log('isPowered:', !!(data.power));
  } catch (error) {
    console.error('API Error:', error);
  }
}, 3000);
