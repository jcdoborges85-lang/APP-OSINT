export async function calcularHashBuffer(buffer, algoritmo) {
            const hashBuffer = await crypto.subtle.digest(algoritmo, buffer);
            return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
        }
