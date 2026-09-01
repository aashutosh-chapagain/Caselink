import { io } from 'socket.io-client';

const TOKEN = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2YTkyYTg5MTMwYmEyZTNlZGU3NTgyNjkiLCJ3b3Jrc3BhY2VJZCI6IjZhOTJhODkxMzBiYTJlM2VkZTc1ODI2NyIsInJvbGUiOiJjYXNld29ya2VyIiwiaWF0IjoxNzg4MjQ2OTY1LCJleHAiOjE3ODg4NTE3NjV9.kwAB61LcQPXQf4sh6jOMNi44PZlLTLtwaLJLZKt0lCs`;

const socket = io(`http://localhost:5001`, {
    auth: {
        token: TOKEN
    },
});

socket.on('connect', () => {
    console.log('Socket connected with ID:', socket.id);
});

socket.on('connect_error', (err) => console.error('Socket connection error:', err.message));

socket.on('case:created', (data) => console.log('Case created event received:', data));
socket.on('case:updated', (data) => console.log('Case updated event received:', data));
socket.on('activity:added', (data) => console.log('Activity added event received:', data));