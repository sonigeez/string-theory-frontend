import React, { useState, ChangeEvent, useRef, useEffect } from 'react';
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { toBlobURL, fetchFile } from "@ffmpeg/util";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

const supabase = createClient(supabaseUrl!, supabaseKey!);




const AudioUploadComponent: React.FC = () => {
    const [videoFile, setVideoFile] = useState<File | null>(null);
    const [loaded, setLoaded] = useState(false);
    const [audioUrl, setAudioUrl] = useState('');
    const ffmpegRef = useRef(new FFmpeg()); // Updated initialization

    useEffect(() => {
        console.log('useEffect');
        setLoaded(true);
        const load = async () => {
            const baseURL = "http://unpkg.com/@ffmpeg/core-mt@0.12.5/dist/esm";
            const ffmpeg = ffmpegRef.current;
            if (loaded) {
                console.log('already loaded');
                return;
            }
            console.log('load');
            ffmpeg.on("log", ({ message }) => {
                console.log(message);
            });
            console.log('load start');
            try {
                await ffmpeg.load({
                    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
                    wasmURL: await toBlobURL(
                        `${baseURL}/ffmpeg-core.wasm`,
                        "application/wasm"
                    ),
                    workerURL: await toBlobURL(
                        `${baseURL}/ffmpeg-core.worker.js`,
                        "text/javascript"
                    ),
                });
            } catch (error) {
                console.error(error);
            }

            console.log('load end');
        };

        load();
    }, []);

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files ? event.target.files[0] : null;
        setVideoFile(file);
    };

    const convertToAudio = async () => {
        try {
            const ffmpeg = ffmpegRef.current;
            const filename = videoFile!.name;
            const outputFilename = filename.replace(/\.[^/.]+$/, "") + ".mp3";

            // Updated method for writing file
            await ffmpeg.writeFile(filename, await fetchFile(videoFile!));

            // Updated method for executing FFmpeg command
            await ffmpeg.exec(['-i', filename, '-q:a', '0', '-map', 'a', outputFilename]);

            // Updated method for reading file
            const audio = await ffmpeg.readFile(outputFilename);

            const url = URL.createObjectURL(new Blob([audio], { type: 'audio/mpeg' }));
            //convert it to a file to upload to s3
            const file = new File([audio], outputFilename, { type: 'audio/mpeg' });
            //upload to supabase
            const { data, error } = await supabase.storage.from('audios').upload(outputFilename, file);
            if (error) {
                console.error(error);
                return;
            }
            console.log(data);

            //get public url
            const { data: data2 } = supabase.storage
                .from('audios')
                .getPublicUrl(outputFilename);

            console.log(data2.publicUrl);
            if (data2.publicUrl === null) return;

            const body = JSON.stringify({
                audio_url: data2.publicUrl,
            })

            const res = await fetch("https://zqyzirnodguhyqobmspr.supabase.co/functions/v1/transcribe", {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    //cross origin
                    ...corsHeaders,
                    "Cross-Origin-Opener-Policy": "*",
                    "Cross-Origin-Embedder-Policy": "*",


                },
                body: body
            })
            const data3 = await res.json()
            console.log(data3)
            setAudioUrl(url);

        } catch (error) {
            console.log('convertToAudio catch');
            console.error(error);
        }

    };

    return (
        <div className="flex flex-col items-center justify-center p-4 border border-gray-300 rounded-lg shadow-sm">
            <input
                type="file"
                accept="video/*"
                onChange={handleFileChange}
                className="mb-2 block w-full px-3 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
            {videoFile && (
                <>
                    <p className="text-sm text-gray-600">
                        File selected: <span className="font-semibold">{videoFile.name}</span>
                    </p>
                    <button
                        onClick={convertToAudio}
                        className="mt-2 px-4 py-2 bg-indigo-600 text-white rounded"
                    >
                        Convert to Audio
                    </button>
                </>
            )}
            {audioUrl && (
                <a href={audioUrl} download>
                    Download Converted Audio
                </a>
            )}
            {
                loaded && <p>Loaded</p>
            }
        </div>
    );
};

export default AudioUploadComponent;


export const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}