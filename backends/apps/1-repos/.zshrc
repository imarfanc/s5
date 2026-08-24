# cmux1 opt-in prompt wrapper, stage 2 of 2. Native mode never reads this file.

if [[ -n "$CMUX1_ORIGINAL_ZDOTDIR" && "$CMUX1_ORIGINAL_ZDOTDIR" != "$HOME" ]]; then
  export ZDOTDIR="$CMUX1_ORIGINAL_ZDOTDIR"
  cmux1_rc="$ZDOTDIR/.zshrc"
else
  unset ZDOTDIR
  cmux1_rc="$HOME/.zshrc"
fi

[[ -r "$cmux1_rc" ]] && source "$cmux1_rc"

# zsh temporarily saw this backend folder as ZDOTDIR while locating the
# wrapper. Some configs derive HISTFILE during that window. Never let runtime
# history touch watched backend code: that restarts the dev server and closes
# every terminal WebSocket.
if [[ -n "$HISTFILE" && "$HISTFILE" == "$CMUX1_DIR/"* ]]; then
  HISTFILE="${ZDOTDIR:-$HOME}/.zsh_history"
fi

unset cmux1_rc CMUX1_ORIGINAL_ZDOTDIR CMUX1_DIR

# Set the prompt from a precmd hook rather than by plain assignment. A framework
# that rewrites PROMPT before every prompt (powerlevel10k, starship, oh-my-zsh
# themes) reassigns it after this file finishes and would win otherwise.
cmux1_prompt() {
  if [[ "$CMUX1_PROMPT" == "arrow" ]]; then
    PROMPT='%F{#6fd6c4}%n%f %F{#f4b8c5}%m%f %F{#e8d5a3}%~%f %F{#6fd6c4}❯%f '
  else
    PROMPT='%K{#6fd6c4}%F{#0b0e13} %n %K{#f4b8c5}%F{#6fd6c4}%F{#3d1f2a} %m %K{#e8d5a3}%F{#f4b8c5}%F{#3a3020} %~ %k%F{#e8d5a3}%f '
  fi
  RPROMPT=''
}

if autoload -Uz add-zsh-hook 2>/dev/null; then
  add-zsh-hook precmd cmux1_prompt
else
  precmd_functions+=(cmux1_prompt)
fi
cmux1_prompt
