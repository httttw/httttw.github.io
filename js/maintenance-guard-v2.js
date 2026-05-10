(function () {
    var MAINTENANCE_MODE = false;
    var path = String(window.location.pathname || '').toLowerCase();
    var adminPaths = ['admin.html', 'admin_login.html', 'support_admin.html'];

    if (!MAINTENANCE_MODE) return;
    if (path.indexOf('maintenance.html') >= 0) return;

    for (var i = 0; i < adminPaths.length; i += 1) {
        if (path.indexOf(adminPaths[i]) >= 0) return;
    }

    window.location.replace('/maintenance.html');
})();
