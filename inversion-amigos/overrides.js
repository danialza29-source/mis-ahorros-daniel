// UI override: remove the manual "Reenviar correo" action from aporte history.
const _originalDepositsTab = depositsTab;
depositsTab = function(){
  const html = _originalDepositsTab();
  return html.replace(/<button class="btn secondary" onclick="resendDepositEmail\('[^']+'\)">Reenviar correo<\/button>/g,'');
};
