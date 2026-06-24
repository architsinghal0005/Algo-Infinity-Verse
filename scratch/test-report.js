import { handleReportRequest } from '../backend/reports/reportGenerator.js';
import fs from 'fs';

const req = {
    method: 'GET'
};

const res = {
    writeHead: (status, headers) => {
        console.log(`Status: ${status}`);
        console.log(`Headers:`, headers);
    },
    end: (buffer) => {
        if (Buffer.isBuffer(buffer)) {
            fs.writeFileSync('scratch/test-report-output.pdf', buffer);
            console.log('PDF saved to scratch/test-report-output.pdf, size:', buffer.length);
        } else {
            console.log('Response ended with:', buffer);
        }
    }
};

const session = {
    sub: 'test-user-123',
    name: 'Test User',
    email: 'test@example.com'
};

async function test() {
    console.log('Starting PDF generation test...');
    await handleReportRequest(req, res, '/api/reports/export/pdf', session);
    console.log('Test completed');
    process.exit(0);
}
test();
