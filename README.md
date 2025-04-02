## install vosk and example

```
$python3 -m venv venv
$source venv/bin/activate
$venv/bin/python3 -m pip install vosk sounddevice

$venv/bin/python3 test_microphone.py
```

## install vosk nodejs on mac

seems like macbook m2 has some compatibility issue installing vosk nodejs. For now the best approach is prob run vosk in docker env and send audio wav via websocket/some other apis

## use vosk docker server

```
$node test.js
```

note the server parsing is pretty slow right now
