# cmux1 opt-in prompt wrapper, stage 1 of 2. Native mode never reads this file.
#
# Pointing ZDOTDIR at this folder also moves .zshenv, so zsh would skip the
# user's own and start without whatever PATH and env it sets. Load theirs here,
# then take ZDOTDIR back so stage 2 (.zshrc) still runs.

cmux1_dir="${CMUX1_DIR:-${0:A:h}}"
cmux1_home="${CMUX1_ORIGINAL_ZDOTDIR:-$HOME}"

ZDOTDIR="$cmux1_home"
[[ -r "$cmux1_home/.zshenv" ]] && source "$cmux1_home/.zshenv"

# The user's .zshenv may point ZDOTDIR somewhere else. That is the one stage 2
# has to restore, not the value we started with.
export CMUX1_ORIGINAL_ZDOTDIR="${ZDOTDIR:-$cmux1_home}"
ZDOTDIR="$cmux1_dir"
unset cmux1_dir cmux1_home
