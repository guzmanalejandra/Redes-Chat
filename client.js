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
let solicitudesamistad = [];
let userPresenceStatus = "online";



async function loggedInMenu() {
    console.log('\n===================================');
    console.log('   Menú de Usuario   ');
    console.log('===================================');
    console.log('\nPor favor, elige una opción:');
    console.log('[1] Mensaje Privado');                        
    console.log('[2] Gestionar Contactos');                    
    console.log('[3] Mostrar detalles de contacto');           
    console.log('[4] Mostrar usuarios/contactos y su estado'); 
    console.log('[5] Conversaciones grupales');                
    console.log('[6] Definir mensaje de presencia');           
    console.log('[7] Eliminar cuenta');                        
    console.log('[8] Cerrar sesión');                         
    console.log('[9] Salir');  
    console.log('[10] Ver mi propio estado.');                                 
    console.log('===================================');
    
    rl.question('Su opción: ', choice => {
        switch (choice) {
            case '1':
                sendPrivateMessage();
                break;
            case '2':
                manageContactsMenu();
                break;
            case '3':
                showContactDetails();    // Asegúrate de implementar esta función
                break;
            case '4':
                showUsersAndStatus();
                break;
            case '5':
                groupConversations();    // Asegúrate de implementar esta función
                break;
            case '6':
                setPresenceMessage();    // Asegúrate de implementar esta función
                break;
            case '7':
                rl.question('¿Está seguro de que desea eliminar su cuenta? (sí/no): ', response => {
                    if (response.toLowerCase() === 'sí' || response.toLowerCase() === 'si') {
                        deleteAccount();
                    } else {
                        loggedInMenu();
                    }
                });
                break;
                case '8':
                    if (Online()) {
                        logout().then(() => {
                            console.log('¡Sesión cerrada correctamente!');
                            mainMenu();
                        }).catch(err => {
                            console.error('Lo siento, hubo un problema:', err.message);
                            loggedInMenu();
                        });
                    } else {
                        console.log("No hay sesión activa para cerrar.");
                        mainMenu();
                    }
                    break;
            case '9':
                logout().then(() => {
                    console.log('¡Gracias por usar Alumnchat! ¡Hasta pronto!');
                    rl.close();
                }).catch(err => {
                    console.error('Lo siento, hubo un problema:', err.message);
                    rl.close();
                });
                break;
                case '10':
                    viewOwnStatus(); 
                break;
            default:
                console.log('Lo siento, esa no es una opción válida. Por favor, intente de nuevo.');
                loggedInMenu();
                break;
            
        }
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


    xmpp.on("error", (err) => {
        if (err.condition !== 'not-authorized') { 
            console.error("Error en la conexión:", err);
        }
    });

    xmpp.on("online", async () => {
        console.log("Conexión exitosa.");
        await xmpp.send(xml("presence",{type: "online"}));
        loggedInMenu();  
        xmpp.on("stanza", async (stanza) => {
            if (stanza.is("message")) {
                console.log("Stanza recibida:", stanza.toString());
                const body = stanza.getChild("body");
                const from =  stanza.attrs.from;
                if (body) {
                    const messageText = body.children[0];
                    const sender = from.split('@')[0];
                    if(stanza.getChildText("filename")) {
                        const fileName = stanza.getChildText("filename");
                        const fileData = messageText;
                        const saveDir = './recived_files';
                        const savePath = path.join(saveDir, fileName);
                        await this.saveBase64ToFile(fileData, savePath);
                        console.log(`\nArchivo recibido de ${sender}:`, fileName);
                    } else {
                        console.log(`\nMensaje recibido de ${sender}:`, messageText);
                    }
                }
            } else if (stanza.is('presence') && stanza.attrs.type === 'subscribe') {
                const from = stanza.attrs.from;
                solicitudesamistad.push(from);
            } else if(stanza.is('message') && stanza.getChild('body')) {
                if (stanza.attrs.type === "groupchat") {
                    const from = stanza.attrs.from;
                    const body = stanza.getChildText("body");
                    if (from && body) {
                        console.log(`Mensaje de grupo: ${from}: ${body}`);
                    }
                }
            }
        });
    }); 

    try {
        await xmpp.start();
        return true;  
    } catch (err) {
        if (err.condition === 'not-authorized') {
            console.error('\nCredenciales incorrectas! Intente de nuevo.');
        } else {
            console.error('Lo siento, hubo un problema:', err.message);
        }
        return false;  
    }
}

function Online() {
    return xmpp !== null && xmpp.status === "online";
}

async function logout() {
    if (Online()) {
        try {
            await xmpp.stop();
            xmpp = null;
            console.log("Desconectado del servidor XMPP.");
        } catch (err) {
            console.error('Error al desconectar:', err.message);
            throw err;
        }
    } else {
        console.log("No hay sesión activa para cerrar.");
    }
}

async function addContacts() {
    rl.question('Ingrese el nombre de usuario que desea agregar: ', contact => {
        const presenceStanza = xml(
            'presence',
            { to: `${contact}@${domain}`, type: 'subscribe' }
        );
        xmpp.send(presenceStanza);
        console.log(`Solicitud enviada a ${contact}.`);
        manageContactsMenu();
    });
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

function manageContactsMenu() {
    console.log('\n===================================');
    console.log('   Gestionar Contactos   ');
    console.log('===================================');
    console.log('\nPor favor, elige una opción:');
    console.log('[1] Agregar contacto');                        
    console.log('[2] Ver solicitudes de amistad');
    console.log('[3] Regresar al menú principal');   
    console.log('===================================');
    
    rl.question('Su opción: ', choice => {
        switch (choice) {
            case '1':
                addContacts();
                break;
            case '2':
                viewFriendRequests();
                break;
            case '3':
                loggedInMenu();
                break;
            default:
                console.log('Lo siento, esa no es una opción válida. Por favor, intente de nuevo.');
                manageContactsMenu();
                break;
        }
    });
}

function viewFriendRequests() {
    if (solicitudesamistad.length === 0) {
        console.log('\nNo tienes nuevas solicitudes de amistad.');
        manageContactsMenu();
    } else {
        console.log('\nSolicitudes de amistad pendientes:');
        solicitudesamistad.forEach((from, index) => {
            console.log(`${index + 1}. ${from.split('@')[0]}`);
        });

        rl.question('\nIngrese el número de la solicitud que desea aceptar o "salir" para volver: ', choice => {
            const index = parseInt(choice) - 1;
            if (!isNaN(index) && index >= 0 && index < solicitudesamistad.length) {
                acceptFriendRequest(solicitudesamistad[index]);
                solicitudesamistad.splice(index, 1);
            } else if (choice.toLowerCase() === "salir") {
                manageContactsMenu();
            } else {
                console.log('Opción no válida. Por favor, intente de nuevo.');
                viewFriendRequests();
            }
        });
    }
}

function acceptFriendRequest(jid) {
    const presenceStanza = xml(
        'presence',
        { to: jid, type: 'subscribed' }
    );
    xmpp.send(presenceStanza);
    console.log(`Has aceptado la solicitud de amistad de ${jid.split('@')[0]}.`);

    rl.question('Ingrese un nombre o alias para este contacto: ', alias => {
        addContactToRoster(jid, alias);
    });
}

function addContactToRoster(jid, alias) {
    const rosterStanza = xml(
        'iq',
        { type: 'set', id: 'add_to_roster' },
        xml('query', { xmlns: 'jabber:iq:roster' },
            xml('item', { jid: jid, name: alias })
        )
    );

    xmpp.send(rosterStanza).then(() => {
        console.log(`Contacto ${jid.split('@')[0]} agregado con el nombre ${alias}.`);
        manageContactsMenu();
    }).catch((err) => {
        console.error('Error al agregar contacto al roster:', err.message);
        manageContactsMenu();
    });
}

function sendPrivateMessage(recipient) {
    if (!recipient) {
        rl.question('Ingrese el nombre de usuario al que desea enviar el mensaje: ', recipientInput => {
            loopSendMessage(recipientInput);
        });
    } else {
        loopSendMessage(recipient);
    }
}

function loopSendMessage(recipient) {
    rl.question('Ingrese el mensaje (o escriba "salirchat" para terminar): ', messageText => {
        if (messageText.toLowerCase() === 'salirchat') {
            loggedInMenu();
            return;
        }
        const messageStanza = xml(
            'message',
            { to: `${recipient}@${domain}`, type: 'chat' },
            xml('body', {}, messageText)
        );
        xmpp.send(messageStanza);
        console.log(`Mensaje enviado a ${recipient}.`);
        loopSendMessage(recipient);  // Continúa solicitando más mensajes para el mismo destinatario.
    });
}

function setPresenceMessage() {
    rl.question('Ingrese el estado (online, away, dnd, xa, offline): ', status => {
        rl.question('Ingrese el mensaje de presencia (opcional): ', message => {
            let presenceAttributes = {};
            let presenceChildren = [];

            // Si el estado es "offline", se establece el atributo type a "unavailable"
            if (status === 'offline') {
                presenceAttributes.type = 'unavailable';
            } else if (status !== 'online') { // Para otros estados que no son "online" ni "offline"
                presenceChildren.push(xml('show', {}, status));
            }

            // Si hay un mensaje de presencia, se añade
            if (message) {
                presenceChildren.push(xml('status', {}, message));
            }

            const presenceStanza = xml('presence', presenceAttributes, ...presenceChildren);
            
            xmpp.send(presenceStanza);

            // Actualiza el estado de presencia del usuario en la variable global
            userPresenceStatus = status;

            console.log(`Estado establecido a "${status}" con el mensaje "${message || 'Ninguno'}".`);
            loggedInMenu();
        });
    });
}


function viewOwnStatus() {
    // Aquí, simplemente mostramos el estado y mensaje actual.
    console.log(`Tu estado actual es: "${userPresenceStatus}"`);
    loggedInMenu();
}

mainMenu();
