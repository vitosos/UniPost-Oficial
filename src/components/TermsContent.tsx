import Image from "next/image";
import UniPostLogo from "@/app/assets/UniPost.png";

export default function TermsContent() {
    return (
        <div className="max-w-4xl mx-auto bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-3xl p-8 md:p-16 shadow-2xl">

            {/* Header con Logo */}
            <div className="flex flex-col items-center justify-center mb-12 border-b border-white/10 pb-8">
                <div className="bg-white/10 p-4 rounded-2xl mb-4 shadow-lg">
                    <Image
                        src={UniPostLogo}
                        alt="UniPost Logo"
                        width={64}
                        height={64}
                        className="h-16 w-16"
                    />
                </div>
                <h1 className="text-4xl font-bold text-white tracking-tight text-center">Términos de Contenido y Uso</h1>
                <p className="text-slate-400 mt-2">Última actualización: Noviembre 2025</p>
            </div>

            {/* Contenido del Contrato */}
            <div className="space-y-12 text-lg leading-relaxed text-slate-300 text-left">

                {/* 1. Introducción */}
                <section>
                    <h2 className="text-2xl font-bold text-white mb-4">
                        1. Introducción
                    </h2>
                    <p>
                        Bienvenido a <strong>UniPost</strong>. Al utilizar nuestra plataforma para la gestión y publicación de contenido en redes sociales, aceptas cumplir con los siguientes términos. Nuestro objetivo es proporcionar una herramienta segura y eficiente para creadores y empresas.
                    </p>
                </section>

                {/* 2. Privacidad y Seguridad */}
                <section>
                    <h2 className="text-2xl font-bold text-white mb-4">
                        2. Privacidad y Seguridad de Datos
                    </h2>
                    <p className="mb-4">
                        La seguridad de tus datos es nuestra prioridad. En UniPost implementamos estándares industriales para proteger tu información:
                    </p>
                    <ul className="list-disc pl-6 space-y-2 marker:text-indigo-400">
                        <li><strong>Encriptación:</strong> Tus credenciales y tokens de acceso a redes sociales (Instagram, Facebook, TikTok, Bluesky) se almacenan encriptados en nuestra base de datos.</li>
                        <li><strong>No compartimos datos:</strong> No vendemos ni cedemos tu información personal a terceros.</li>
                        <li><strong>Acceso limitado:</strong> Solo utilizamos los permisos estrictamente necesarios para publicar y obtener métricas en tu nombre.</li>
                    </ul>
                </section>

                {/* 3. Contenido Restringido (NSFW/Odio) */}
                <section className="bg-orange-500/10 border border-orange-500/20 p-6 rounded-2xl">
                    <h2 className="text-2xl font-bold text-orange-200 mb-4 flex items-center gap-2">
                        3. Restricciones de Contenido
                    </h2>
                    <p className="mb-4">
                        UniPost promueve un entorno seguro. Está estrictamente prohibido publicar o marcar como "Visible" en el feed público contenido que incluya:
                    </p>
                    <ul className="list-disc pl-6 space-y-2 marker:text-orange-400">
                        <li><strong>Contenido NSFW:</strong> Material pornográfico, sexualmente explícito o desnudez no artística.</li>
                        <li><strong>Violencia Gráfica:</strong> Imágenes de violencia real, gore, automutilación o crueldad animal.</li>
                        <li><strong>Discursos de Odio:</strong> Contenido que ataque, amenace o degrade a grupos basado en raza, religión, orientación sexual, discapacidad o identidad de género.</li>
                    </ul>
                    <p className="mt-4 text-sm text-orange-200/80">
                        * La violación de estas normas resultará en la eliminación del contenido y la suspensión temporal o definitiva de la cuenta.
                    </p>
                </section>

                {/* 4. Acoso y Bullying 
                5. Actividades Ilegales */}
                <section className="bg-red-500/10 border border-red-500/20 p-6 rounded-2xl">
                    <h2 className="text-2xl font-bold text-red-200 mb-4 flex items-center gap-2">
                        4. Acoso y Ciberacoso (Bullying)
                    </h2>
                    <p className="mb-4">
                        Tenemos una política de <strong>Tolerancia Cero</strong> hacia el hostigamiento. Queda prohibido utilizar la plataforma para:
                    </p>
                    <ul className="list-disc pl-6 space-y-2 marker:text-red-400">
                        <li>Acosar, intimidar o amenazar a otros usuarios o personal de UniPost.</li>
                        <li>Realizar <strong>Doxxing</strong> (publicar información privada o de identificación de terceros sin su consentimiento).</li>
                        <li>Incitar a otros a realizar actos de acoso masivo.</li>
                    </ul>

                    <h2 className="text-2xl font-bold text-red-200 mb-4 flex items-center gap-2 pt-6">
                        5. Actividades Ilegales
                    </h2>

                    <p className="mb-4">
                        Está prohibido el uso de UniPost para la promoción, planificación o ejecución de cualquier actividad que viole las leyes locales o internacionales, incluyendo pero no limitado a:
                    </p>
                    <ul className="list-disc pl-6 space-y-2 marker:text-indigo-400">
                        <li>Terrorismo o extremismo violento.</li>
                        <li>Venta de bienes regulados o ilegales (drogas, armas, etc.).</li>
                        <li>Fraude, lavado de dinero o delitos informáticos.</li>
                        <li>Explotación infantil de cualquier tipo.</li>
                    </ul>
                    <p className="mt-4 text-slate-400 text-sm">
                        Reportaremos proactivamente cualquier indicio de actividad criminal a las autoridades correspondientes.
                    </p>

                    <div className="mt-6 p-4 bg-red-500/20 rounded-xl border border-red-500/30">
                        <p className="font-bold text-white flex items-center gap-2">
                            🚨 Consecuencias Graves
                        </p>
                        <p className="text-sm text-red-100 mt-1">
                            Cualquier usuario que participe en estas actividades sufrirá la <strong>prohibición permanente (baneo)</strong> de acceso a la plataforma. Además, UniPost se reserva el derecho de <strong>contactar a las autoridades legales pertinentes</strong> y suministrar la información necesaria para la investigación.
                        </p>

                    </div>

                </section>

                {/* 6. Propiedad Intelectual */}
                <section>
                    <h2 className="text-2xl font-bold text-white mb-4">
                        6. Propiedad Intelectual
                    </h2>
                    <p>
                        Tú conservas todos los derechos y la propiedad intelectual de los contenidos (imágenes, videos, textos) que subas y publiques a través de UniPost. Al usar la función "Visible en Feed", nos otorgas una licencia no exclusiva para mostrar dicho contenido dentro de la plataforma UniPost con fines demostrativos y comunitarios.
                    </p>
                </section>

                {/* 7. Responsabilidad */}
                <section>
                    <h2 className="text-2xl font-bold text-white mb-4">
                        7. Responsabilidad de la Cuenta
                    </h2>
                    <p>
                        Eres responsable de mantener la confidencialidad de tu contraseña y de todas las actividades que ocurran bajo tu cuenta. UniPost no se hace responsable por accesos no autorizados derivados de un descuido en la seguridad por parte del usuario.
                    </p>
                </section>
            </div>
        </div>
    );
}