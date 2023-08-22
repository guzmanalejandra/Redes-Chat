
const { client, xml } = require("@xmpp/client");
const readline = require("readline");
const net = require('net');
const fs = require("fs");
const path = require('path');

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

let xmpp = null;
let username = null;
let password = null;
const service = "xmpp://alumchat.xyz:5222";
const domain = "alumchat.xyz";

async function register(usernameInput, passwordInput, email) {
    return new Promise(async (resolve, reject) => {
        if (xmpp) {
            reject(new Error('Ya existe una conexión.'));
        }
        
        username = usernameInput;
        password = passwordInput;
        xmpp = client({
            service: service,
            domain: domain,
            username: username,
            password: password,
        });

        try {
            await xmpp.start();
        } catch (err) {
            reject(new Error('Error al establecer la conexión.'));
        }

        const registerStanza = xml(
            'iq',
            { type: 'set', id: 'register' },
            xml('query', { xmlns: 'jabber:iq:register' },
                xml('username', {}, username),
                xml('password', {}, password),
                xml('email', {}, email)
            )
        );

        xmpp.send(registerStanza).then(() => {
            resolve();
        }).catch((err) => {
            reject(new Error('Error al registrar el usuario.'));
        });
    });
}

async function login(usernameInput, passwordInput) {
    username = usernameInput;
    password = passwordInput;
    xmpp = client({
        service: service,
        domain: domain,
        username: username,
        password: password,
    });

    xmpp.on("online", async () => {
        await xmpp.send(xml("presence"));
    });

    try {
        await xmpp.start();
    } catch (err) {
        if (err.condition === 'not-authorized') {
            throw new Error('\\nCredenciales incorrectas! Intente de nuevo.');
        } else {
            throw err;
        }
    }
}

async function logout() {
    if (!xmpp) {
        throw new Error("Error en la conexion, intenta de nuevo.");
    }

    await xmpp.stop();
    xmpp = null;
    username = null;
    password = null;
}

function mainMenu() {
    console.log('\n===================================');
    console.log('   Bienvenido a ALUMNCHAT!   ');
    console.log('===================================');
    console.log('\nPor favor, elige una opción:');
    console.log('[1] Registrarse en la plataforma');
    console.log('[2] Iniciar sesión en su cuenta');
    console.log('[3] Salir de la aplicación');
    console.log('===================================');
    
    rl.question('Su opción: ', choice => {
        switch (choice) {
            case '1':
                console.log('\n--- Registro ---');
                rl.question('Ingrese su nombre de usuario: ', usernameInput => {
                    rl.question('Ingrese su contraseña: ', passwordInput => {
                        rl.question('Ingrese su correo electrónico: ', email => {
                            register(usernameInput, passwordInput, email).then(() => {
                                console.log('¡Gracias por registrarse con nosotros!');
                                mainMenu();
                            }).catch(err => {
                                console.error('Lo siento, hubo un problema:', err.message);
                                mainMenu();
                            });
                        });
                    });
                });
                break;
            case '2':
                console.log('\n--- Iniciar sesión ---');
                rl.question('Nombre de usuario: ', usernameInput => {
                    rl.question('Contraseña: ', passwordInput => {
                        login(usernameInput, passwordInput).then(() => {
                            console.log('¡Bienvenido de nuevo!');
                            mainMenu();
                        }).catch(err => {
                            console.error('Lo siento, hubo un problema:', err.message);
                            mainMenu();
                        });
                    });
                });
                break;
            case '3':
                logout().then(() => {
                    console.log('¡Gracias por usar nuestra aplicación! ¡Hasta pronto!');
                    rl.close();
                }).catch(err => {
                    console.error('Lo siento, hubo un problema:', err.message);
                    rl.close();
                });
                break;
            default:
                console.log('Lo siento, esa no es una opción válida. Por favor, intente de nuevo.');
                mainMenu();
                break;
        }
    });
}

mainMenu();