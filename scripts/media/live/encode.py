import subprocess, json, os, sys
# Recipe for public/media/live. Source files are downloaded by hand (see README.md here) into
# ./mkv (Mixkit videos, <id>.mp4), ./music (Mixkit music, mk<id>.mp3) and ./nasa (NASA videos).
# Run from the folder that holds them: python3 scripts/media/live/encode.py
import pathlib
OUT=str(pathlib.Path(__file__).resolve().parents[3]/'public/media/live')
MK='mkv'; MU='music'; NA='nasa'
def run(args):
    r=subprocess.run(['ffmpeg','-v','error','-y']+args,capture_output=True,text=True)
    if r.returncode: print('FAIL',args[-1],r.stderr[-400:]); sys.exit(1)
def dur(p): return float(subprocess.run(['ffprobe','-v','error','-show_entries','format=duration','-of','csv=p=0',p],capture_output=True,text=True).stdout)
def vcrop(cx):  # vertical 9:16 window centred on cx (0..1) of a 16:9 frame
    return f"crop=ih*9/16:ih:max(0\\,min(iw-ih*9/16\\,iw*{cx}-ih*9/32)):0,scale=540:960:flags=lanczos,fps=30,format=yuv420p"
def song(name, clip, cx, track):
    src=f'{MK}/{clip}.mp4'; mus=f'{MU}/mk{track}.mp3'; d=dur(mus)
    out=f'{OUT}/{name}.mp4'
    run(['-stream_loop','-1','-i',src,'-i',mus,'-t',f'{d:.2f}','-map','0:v','-map','1:a','-vf',vcrop(cx),
         '-c:v','libx264','-preset','slow','-crf','29','-maxrate','700k','-bufsize','1400k','-g','60',
         '-af',f'afade=t=in:d=0.6,afade=t=out:st={d-2.2:.2f}:d=2.2','-c:a','aac','-b:a','128k','-movflags','+faststart',out])
    run(['-ss','1.2','-i',out,'-frames:v','1','-q:v','4',f'{OUT}/{name}.jpg'])
    return round(d,2)
def moment(name, clip, cx, track, offset=40, vol=0.55):
    src=f'{MK}/{clip}.mp4'; mus=f'{MU}/mk{track}.mp3'; d=dur(src)
    L=max(d, 12.0) if d>=12 else d*2  # very short clips play twice
    L=min(L, 22.0)
    out=f'{OUT}/{name}.mp4'
    run(['-stream_loop','-1','-i',src,'-ss',str(offset),'-i',mus,'-t',f'{L:.2f}','-map','0:v','-map','1:a','-vf',vcrop(cx),
         '-c:v','libx264','-preset','slow','-crf','26','-maxrate','1200k','-bufsize','2400k','-g','60',
         '-af',f'volume={vol},afade=t=in:d=0.8,afade=t=out:st={L-1.2:.2f}:d=1.2','-c:a','aac','-b:a','96k','-movflags','+faststart',out])
    run(['-ss','0.8','-i',out,'-frames:v','1','-q:v','4',f'{OUT}/{name}.jpg'])
    return round(L,2)
def avatar(name, clip, t, cx, cy, size):  # square crop of side `size` (fraction of height) centred at cx,cy
    run(['-ss',str(t),'-i',f'{MK}/{clip}.mp4' if not clip.startswith('nasa/') else clip,'-frames:v','1','-vf',
         f"crop=ih*{size}:ih*{size}:iw*{cx}-ih*{size}/2:ih*{cy}-ih*{size}/2,scale=320:320:flags=lanczos",'-q:v','3',f'{OUT}/{name}.jpg'])
def episode(name, src, start, length):
    out=f'{OUT}/{name}.mp4'
    run(['-ss',str(start),'-i',f'{NA}/{src}.mp4','-t',str(length),'-vf','scale=640:360:flags=lanczos,fps=30,format=yuv420p',
         '-c:v','libx264','-preset','slow','-crf','29','-maxrate','330k','-bufsize','660k','-g','60',
         '-af',f'afade=t=in:d=0.8,afade=t=out:st={length-1.5}:d=1.5','-c:a','aac','-b:a','64k','-ac','1','-movflags','+faststart',out])
    run(['-ss','20','-i',out,'-frames:v','1','-q:v','4',f'{OUT}/{name}.jpg'])
    return round(dur(out),2)
if __name__=='__main__':
    plan=json.load(open('plan.json')); res={}
    for s in plan['songs']: res[s['name']]=song(s['name'],s['clip'],s['cx'],s['track']); print('song',s['name'],res[s['name']])
    for m in plan['moments']: res[m['name']]=moment(m['name'],m['clip'],m['cx'],m['track']); print('moment',m['name'],res[m['name']])
    for a in plan['avatars']: avatar(a['name'],a['clip'],a['t'],a['cx'],a['cy'],a['size']); print('avatar',a['name'])
    for e in plan['episodes']: res[e['name']]=episode(e['name'],e['src'],e['start'],e['length']); print('episode',e['name'],res[e['name']])
    json.dump(res,open('encoded.json','w'),indent=1)
