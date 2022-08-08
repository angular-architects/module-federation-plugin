const { withNativeFederation, shareAll } = require('@angular-architects/native-federation/config');

module.exports = withNativeFederation({
<% if (type === 'remote') { %>
  name: '<%=project%>',

  exposes: {
    './Component': './<%=projectSourceRoot%>/app/app.component.ts',
  },
<% } else if (type === 'host') { %>
  remotes: {<% for (key in remoteMap) { %>
    "<%=key%>": "<%=remoteMap[key]%>",<% } %>    
  },
<% } %>
  shared: {
    ...shareAll({ singleton: true, strictVersion: true, requiredVersion: 'auto' }),
  },

});
