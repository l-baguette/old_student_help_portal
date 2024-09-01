require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const path = require('path');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const MongoStore = require('connect-mongo');

// Create Express app
const app = express();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

// Middleware to parse JSON and form data
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Set up sessions
app.use(session({
    secret: 'yourSecretKey',
    resave: false,
    saveUninitialized: true,
    store: MongoStore.create({ mongoUrl: process.env.MONGODB_URI })
}));

// Set up file storage configuration using Multer
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');  // Directory where files will be stored
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));  // Use timestamp as filename
    }
});
const upload = multer({ storage });

// Serve static files from the 'public' directory
app.use(express.static('public'));

// Model imports
const User = require('./models/User');
const Submission = require('./models/Submission');

// Route to handle student registration
app.post('/register', async (req, res) => {
    const { studentId, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({ studentId, password: hashedPassword, role: 'student' });

    try {
        await newUser.save();
        res.status(200).send('Registration successful');
    } catch (error) {
        res.status(500).send('Error registering user');
    }
});

// Route to handle student login
app.post('/student_login', async (req, res) => {
    const { studentId, password } = req.body;
    const user = await User.findOne({ studentId, role: 'student' });

    if (user && await bcrypt.compare(password, user.password)) {
        req.session.user = user;
        res.redirect('/student_dashboard.html'); // Redirect to student dashboard
    } else {
        res.status(401).send('Invalid credentials');
    }
});

// Route to handle teacher login
app.post('/teacher_login', async (req, res) => {
    const { teacherId, password } = req.body;
    const user = await User.findOne({ studentId: teacherId, role: 'teacher' });

    if (user && await bcrypt.compare(password, user.password)) {
        req.session.user = user;
        res.redirect('/teacher_dashboard.html'); // Redirect to teacher dashboard
    } else {
        res.status(401).send('Invalid credentials');
    }
});

// Route to handle form submissions (only for logged-in students)
app.post('/submit', upload.single('fileUpload'), async (req, res) => {
    if (!req.session.user || req.session.user.role !== 'student') {
        return res.status(401).send('Unauthorized');
    }

    const { desiredOutcome, actualOutcome, problem } = req.body;
    const newSubmission = new Submission({
        studentId: req.session.user.studentId,
        desiredOutcome,
        actualOutcome,
        problem,
        filePath: req.file.path
    });

    try {
        await newSubmission.save();  // Save the submission to the database
        res.status(200).send('Submission successful');
    } catch (error) {
        res.status(500).send('Error submitting data');
    }
});

// Route to get all submissions (only for the teacher)
app.get('/submissions', async (req, res) => {
    if (!req.session.user || req.session.user.role !== 'teacher') {
        return res.status(401).send('Unauthorized');
    }

    try {
        const submissions = await Submission.find();
        res.json(submissions);
    } catch (error) {
        res.status(500).send('Error retrieving submissions');
    }
});

// Route to update feedback and upload revised files (only for the teacher)
app.post('/feedback/:id', upload.single('revisedFile'), async (req, res) => {
    if (!req.session.user || req.session.user.role !== 'teacher') {
        return res.status(401).send('Unauthorized');
    }

    try {
        const submission = await Submission.findById(req.params.id);
        submission.feedback = req.body.feedback;
        if (req.file) {
            submission.revisedFilePath = req.file.path;
        }
        await submission.save();  // Save the updated feedback to the database
        res.status(200).send('Feedback updated');
    } catch (error) {
        res.status(500).send('Error updating feedback');
    }
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
