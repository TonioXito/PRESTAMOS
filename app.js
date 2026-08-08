async function verificarEstadoAcceso() {
  if (!supabaseClient) return;

  const loginContainer = document.getElementById('loginContainer');
  const appContent = document.getElementById('appContent');

  // 1. Obtener sesión local
  const { data: { session }, error: sessionError } = await supabaseClient.auth.getSession();

  if (!session || sessionError) {
    // Sin sesión: Mostrar login
    if (loginContainer) loginContainer.style.display = 'flex';
    if (appContent) appContent.style.display = 'none';
    return;
  }

  // 2. Validar directamente contra el servidor de Supabase si el usuario sigue existiendo/activo
  const { data: { user }, error: userError } = await supabaseClient.auth.getUser();

  if (userError || !user) {
    // El usuario fue borrado en Supabase o el token ya no es válido
    await supabaseClient.auth.signOut();
    localStorage.removeItem('sb-' + SUPABASE_URL.split('//')[1].split('.')[0] + '-auth-token');
    if (loginContainer) loginContainer.style.display = 'flex';
    if (appContent) appContent.style.display = 'none';
    return;
  }

  if (user.banned_until) {
    // El usuario fue suspendido/baneado
    mostrarPantallaBloqueo("Tu suscripción ha vencido o tu acceso ha sido suspendido por el administrador.");
    return;
  }

  // Si pasa todas las comprobaciones, mostrar la app
  if (loginContainer) loginContainer.style.display = 'none';
  if (appContent) appContent.style.display = 'block';
}
