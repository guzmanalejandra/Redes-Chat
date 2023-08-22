const net = require('net');
const readline = require('readline');
const { encode } = require('js-base64');
const tls = require('tls');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const client = new net.Socket();

client.on('data', handleData);
client.on('close', handleClose);

function main() {
    console.log('Se consiguió conectar');
    menubar();
}

function menubar() {
    console.log('Bienvenido al chat');
    console.log('1. Ingresar');
    console.log('2. Registrarse');
    console.log('3. Salir');
    rl.question('Ingrese una opción: ', (answer) => {
        switch (answer) {
            case '1':
                login();
                break;
            case '2':
                signUp(); 
                break;
            case '3':
                console.log('Adiós');
                client.destroy();
                break;
            default:
                console.log('Opción inválida');
                menubar();
        }
    });
}

function signUp() {
    client.connect(5222, 'alumchat.xyz', function() {
        // Conexión con el servidor
        client.write("<stream:stream to='alumchat.xyz' xmlns='jabber:client' xmlns:stream='http://etherx.jabber.org/streams' version='1.0'>");
    });

    // Solicitando datos al usuario
    rl.question("Usuario: ", (username) => {
        rl.question("Contraseña: ", (password) => {
            client.on('data', function(data) {
                if (data.toString().includes('<stream:features>')) {
                    // Envía petición de registro
                    const xmlRegister = `
                    <iq type="set" id="reg_1" mechanism='PLAIN'>
                        <query xmlns="jabber:iq:register">
                            <username>${username}</username>
                            <password>${password}</password>
                        </query>
                    </iq>
                    `;
                    client.write(xmlRegister);
                } else if (data.toString().includes('<iq type="result"')) {
                    // Registro completado con éxito
                    console.log('Registro exitoso');
                    showMenu();
                } else if (data.toString().includes('<iq type="error"')) {
                    // Hubo un error durante el registro
                    console.log('Error al registrar', data.toString());
                }
            });
        });
    });
}

function login() {
    console.log("\nInicie su sesión:");
    rl.question('Username: ', jid => {
        rl.question('Password: ', password => {
            client.connect(5222, 'alumchat.xyz', () => {
                console.log('\nEstableciendo conexión con Alumnchat.xyz');
                client.write(`<?xml version='1.0'?>
      <stream:stream to='alumchat.xyz' xmlns='jabber:client' xmlns:stream='http://etherx.jabber.org/streams' version='1.0'>`);
            });

            const authRequest = `<auth xmlns='urn:ietf:params:xml:ns:xmpp-sasl' mechanism='PLAIN'>${encode(
                '\0' + jid + '\0' + password
            )}</auth>`;
            client.write(authRequest);
        });
    });
}

function handleData(data) {
    const dataStr = data.toString();
    console.log("Data recibida del servidor:", dataStr); //verificar

    if (dataStr.includes('<starttls xmlns="urn:ietf:params:xml:ns:xmpp-tls">')) {
        // Solicita iniciar TLS
        client.write('<starttls xmlns="urn:ietf:params:xml:ns:xmpp-tls"/>');
    } else if (dataStr.includes('<proceed xmlns="urn:ietf:params:xml:ns:xmpp-tls"/>')) {
        // Si el servidor nos da permiso, actualizamos a TLS
        upgradeToTLS();
    } 

    if (data.toString().includes('<stream:features>')) {
        if (dataStr.includes('<starttls xmlns="urn:ietf:params:xml:ns:xmpp-tls">')) {
            // Iniciar TLS
            client.write('<starttls xmlns="urn:ietf:params:xml:ns:xmpp-tls"/>');
        } else if (dataStr.includes('<register xmlns="http://jabber.org/features/iq-register"/>')) {
            // Enviar solicitud de registro si TLS ya está establecido
            sendRegisterRequest();
        }
    } 
    
    
    if (data.toString().includes('<success')) {
        console.log('Ha iniciado sesión correctamente.');
        console.log('Bienvenido!');
        submenu(); 
    }
    else if (data.toString().includes('<failure')) {
        console.log('No se pudo iniciar sesión.');
        login();
    }
    //manejo registro
    if (dataStr.includes('<iq type=\'result\' id=\'reg1\'/>')) {
        console.log('Registro exitoso.');
        login();
    }
    else if (dataStr.includes('<iq type=\'error\' id=\'reg1\'')) {
        console.log('Error al intentar registrarse.');
        register();
    }
}

function upgradeToTLS() {
    const secureSocket = tls.connect({
        socket: client, 
        rejectUnauthorized: false // Esto se debe establecer en 'true' en producción y proporcionar un CA
    }, () => {
        console.log('TLS establecido.');
        client = secureSocket; // Actualiza el cliente a la conexión TLS
    });

    secureSocket.on('data', handleData);
    secureSocket.on('error', (err) => {
        console.error('Error TLS:', err);
    });
}

function sendRegisterRequest() {
    const registerRequest = `
    <iq type='set' id='reg1'>
      <query xmlns='jabber:iq:register'>
        <username>${jid}</username>
        <password>${password}</password>
      </query>
    </iq>`;
    client.write(registerRequest);
}


function sendAuthRequest(jid, password) {
    const authRequest = `<auth xmlns='urn:ietf:params:xml:ns:xmpp-sasl' mechanism='PLAIN'>${encode(
        '\0' + jid + '\0' + password
    )}</auth>`;
    client.write(authRequest);
}

function submenu() {
    console.log('----- Menú de Comunicación -----');
    console.log('1. Mostrar todos los usuarios/contactos y su estado');
    console.log('2. Agregar un usuario a los contactos');
    console.log('3. Mostrar detalles de un usuario/contacto');
    console.log('4. Enviar mensaje a un usuario/contacto');
    console.log('5. Mostrar todos los detalles de un usuario/contacto');
    console.log('6. Definir mensaje de presencia');
    console.log('7. Enviar/recibir notificaciones de presencia');
    console.log('8. Enviar/recibir archivos');
    console.log('9. Regresar al menú principal');
    rl.question('Seleccione una opción: ', (answer) => {
        switch (answer) {
            //Falta la implementacion de los casos
            case '9':
                menubar();
                break;
            default:
                console.log('Opción inválida');
                submenu();
        }
    });
}

function handleClose() {
    console.log('\nConexión cerrada.');
}

main(); // Inicia el programa
