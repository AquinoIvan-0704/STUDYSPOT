const { initializeApp } = await import('https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js');
const {
    getAuth,
    GoogleAuthProvider,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signInWithPopup
} = await import('https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js');

async function startFirebaseAuth() {
    const configResponse = await fetch('/api/firebase-config');
    if (!configResponse.ok) throw new Error('Firebase authentication is not configured.');
    const config = await configResponse.json();
    const auth = getAuth(initializeApp(config));

    async function createSession(user) {
        const token = await user.getIdToken();
        const response = await fetch('/api/firebase-session', {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` }
        });
        if (!response.ok) {
            const body = await response.json().catch(() => ({}));
            throw new Error(body.error || 'Could not create a StudySpot session.');
        }
        window.location.assign('/studyspot');
    }

    document.getElementById('loginForm').addEventListener('submit', async (event) => {
        event.preventDefault();
        try {
            const emailOrUsername = document.getElementById('log-username').value.trim();
            if (!emailOrUsername.includes('@')) {
                throw new Error('Firebase login requires your email address.');
            }
            const result = await signInWithEmailAndPassword(
                auth,
                emailOrUsername,
                document.getElementById('log-password').value
            );
            await createSession(result.user);
        } catch (error) {
            SS.toast(error.message, 'error');
        }
    });

    document.getElementById('registerForm').addEventListener('submit', async (event) => {
        event.preventDefault();
        const email = document.getElementById('reg-email').value.trim();
        if (!email) return SS.toast('Email is required for Firebase authentication.', 'error');
        try {
            const result = await createUserWithEmailAndPassword(
                auth,
                email,
                document.getElementById('reg-password').value
            );
            await createSession(result.user);
        } catch (error) {
            SS.toast(error.message, 'error');
        }
    });

    async function googleSignIn() {
        try {
            const result = await signInWithPopup(auth, new GoogleAuthProvider());
            await createSession(result.user);
        } catch (error) {
            SS.toast(error.message, 'error');
        }
    }

    document.getElementById('googleLogin').addEventListener('click', googleSignIn);
    document.getElementById('googleRegister').addEventListener('click', googleSignIn);
}

startFirebaseAuth().catch((error) => {
    console.error(error);
    SS.toast(error.message, 'error');
});
