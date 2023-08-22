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

async function showUsersAndStatus() {
    if (!xmpp) {
        console.log('Por favor, inicie sesión primero.');
        return loggedInMenu();
    }

    // Send roster request
    const rosterRequest = xml(
        'iq',
        { type: 'get', id: 'roster_1' },
        xml('query', { xmlns: 'jabber:iq:roster' })
    );

    xmpp.send(rosterRequest);

    // Listen for the roster response
    xmpp.on('stanza', stanza => {
        if (stanza.is('iq') && stanza.attrs.id === 'roster_1') {
            const contacts = stanza.getChildrenByFilter(child => child.is('item'));
            console.log('\nLista de usuarios y su estado:');
            contacts.forEach(contact => {
                const contactName = contact.attrs.name || contact.attrs.jid;
                const subscription = contact.attrs.subscription;
                console.log(`${contactName} - ${subscription === 'both' ? 'En línea' : 'Desconectado'}`);
            });
        }
    });
}

async function loggedInMenu() {
    console.log('\n===================================');
    console.log('   Menú de Usuario   ');
    console.log('===================================');
    console.log('\nPor favor, elige una opción:');
    console.log('[1] Mostrar usuarios/contactos y su estado');
    console.log('[2] Salir');
    console.log('[3] Eliminar cuenta');
    console.log('[4] Agregar Contacto');
    console.log('[5] Mensaje Privado')
    console.log('===================================');
    
    rl.question('Su opción: ', choice => {
        switch (choice) {
            case '1':
                showUsersAndStatus();
                break;
            case '2':
                logout().then(() => {
                    console.log('Has cerrado sesión.');
                    mainMenu();
                }).catch(err => {
                    console.error('Lo siento, hubo un problema:', err.message);
                    loggedInMenu();
                });
                break;
            case '3':
                rl.question('¿Está seguro de que desea eliminar su cuenta? (sí/no): ', response => {
                    if (response.toLowerCase() === 'sí' || response.toLowerCase() === 'si') {
                        deleteAccount();
                    } else {
                        loggedInMenu();
                    }
                });
                break;
            case '4':
                addContact();
                break;
            default:
                console.log('Lo siento, esa no es una opción válida. Por favor, intente de nuevo.');
                loggedInMenu();
                break;
        }
    });
}

async function sendPrivateMessage() {
    if (!xmpp) {
        console.log('Por favor, inicie sesión primero.');
        return loggedInMenu();
    }

    rl.question('Ingrese el nombre de usuario del destinatario: ', recipient => {
        rl.question('Ingrese su mensaje: ', message => {
            const msgStanza = xml(
                'message',
                { type: 'chat', to: recipient + '@' + domain },
                xml('body', {}, message)
            );

            xmpp.send(msgStanza).then(() => {
                console.log('Mensaje enviado con éxito.');
                loggedInMenu();
            }).catch(err => {
                console.error('Error al enviar el mensaje:', err.message);
                loggedInMenu();
            });
        });
    });
}


async function addContact() {
    if (!xmpp) {
        console.log('Por favor, inicie sesión primero.');
        return loggedInMenu();
    }

    rl.question('Ingrese el nombre de usuario del contacto que desea agregar: ', contactName => {
        const addContactStanza = xml(
            'iq',
            { type: 'set', id: 'add_contact' },
            xml('query', { xmlns: 'jabber:iq:roster' },
                xml('item', { jid: contactName + '@' + domain, name: contactName })
            )
        );

        xmpp.send(addContactStanza).then(() => {
            console.log('Contacto agregado con éxito.');
            loggedInMenu();
        }).catch(err => {
            console.error('Error al agregar el contacto:', err.message);
            loggedInMenu();
        });
    });
}

async function register(usernameInput, passwordInput) {
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
            reject(new Error(err.message));
        }

        const registerStanza = xml(
            'iq',
            { type: 'set', id: 'register' },
            xml('query', { xmlns: 'jabber:iq:register' },
                xml('username', {}, username),
                xml('password', {}, password),
            )
        );

        xmpp.send(registerStanza).then(() => {
            console.log('¡Gracias por registrarse con nosotros!');
            resolve(); 
        }).catch((err) => {
            reject(new Error('Error al registrar el usuario.'));
        });
    });
}

async function deleteAccount() {
    if (!xmpp) {
        console.log('Por favor, inicie sesión primero.');
        return;
    }

    // Manejador de errores específico para la eliminación de la cuenta
    const errorHandler = (err) => {
        if (err.condition === 'not-authorized') {
            console.log('Cuenta eliminada con éxito.');
            xmpp.removeListener('error', errorHandler);  
            logout().then(() => {
                mainMenu();
            });
        }
    };

    // Agregamos el manejador de errores
    xmpp.on('error', errorHandler);

    const deleteStanza = xml(
        'iq',
        { type: 'set', id: 'delete_account' },
        xml('query', { xmlns: 'jabber:iq:register' },
            xml('remove')
        )
    );

    xmpp.send(deleteStanza).catch((err) => {
        xmpp.removeListener('error', errorHandler);
        console.error('Error al eliminar la cuenta:', err.message);
        loggedInMenu();
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

    const onlineListener = async () => {
        await xmpp.send(xml("presence"));
        loggedInMenu();  
    };

    xmpp.on("online", onlineListener);

    try {
        await xmpp.start();
        return true;  // Retorna true si el login es exitoso
    } catch (err) {
        xmpp.removeListener("online", onlineListener); // Remove the online listener
        if (err.condition === 'not-authorized') {
            console.error('\nCredenciales incorrectas! Intente de nuevo.');
        } else {
            console.error('Lo siento, hubo un problema:', err.message);
        }
        return false;  // Retorna false si el login falla
    }
}

async function logout() {
    if (!xmpp) {
        rl.close();
        return;
    }

    await xmpp.stop();
    xmpp = null;
    username = null;
    password = null;
    console.log('Desconectado exitosamente.');
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
                            register(usernameInput, passwordInput).then(() => {
                                console.log('¡Gracias por registrarse con nosotros!');
                                loggedInMenu();
                            }).catch(err => {
                                console.error('Lo siento, hubo un problema:', err.message);
                            });
                    });
                });
                break;
            case '2':
                console.log('\n--- Iniciar sesión ---');
                rl.question('Nombre de usuario: ', usernameInput => {
                    rl.question('Contraseña: ', passwordInput => {
                        login(usernameInput, passwordInput).then((success) => {
                            if (success) {
                                console.log('¡Bienvenido de nuevo!');
                            } else {
                                console.log("")
                                mainMenu()
                            }
                        });
                    });
                });
                break;
            case '3':
                logout().then(() => {
                    console.log('¡Gracias por usar Alumnchat! ¡Hasta pronto!');
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
