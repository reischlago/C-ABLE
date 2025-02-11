from flask import Flask, request, send_from_directory, render_template, jsonify
import os
from convert import process_kml, process_xlsx, process_json
import json

app = Flask(__name__, template_folder=os.getcwd())
app.config['UPLOAD_FOLDER'] = 'uploads/'
app.config['IMPORT_FOLDER'] = 'saved_routes/'
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024

os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)


@app.route('/')
def index():
    return render_template('index.html')


@app.route('/about')
def about():
    return render_template('about.html')


@app.route('/converter')
def converter():
    return render_template('converter.html')


@app.route('/vizualizer')
def vizualizer():
    return render_template('vizualizer.html')

@app.route('/export')
def export():
    return render_template('export.html')

@app.route('/style.css')
def css():
    return send_from_directory('.', 'style.css')

@app.route('/visualizer_script.js')
def visualizer_script():
    return render_template('visualizer_script.js')

@app.route('/converter.js')
def serve_converter_js():
    return send_from_directory('.', 'converter.js')

@app.route('/saved_routes/<path:filename>')
def serve_saved_routes(filename):
    return send_from_directory('saved_routes', filename)

@app.route('/saved_routes', methods=['GET'])
def list_files():
    folder_path = os.path.join(os.getcwd(), 'saved_routes')
    try:
        files = os.listdir(folder_path)
        return jsonify(files=files)
    except FileNotFoundError:
        return jsonify(error="Folder not found"), 404
    except Exception as e:
        return jsonify(error=str(e)), 500

@app.route('/new', methods=['POST'])
def new_route():

    route_name = request.form.get('route_name', 'route')
    file_name = route_name
    while os.path.exists(f'saved_routes/{file_name}.json'):
        file_name += "_"

    with open('assets/empty_route.json', 'r') as f:
        empty_route = json.load(f)

    # Add the route name to the empty_route dictionary
    empty_route['route_name'] = file_name

    with open(f'saved_routes/{file_name}.json', 'w') as f:
        f.write(json.dumps(empty_route, indent=4))

    return render_template('export.html', file_name=file_name)

@app.route('/upload', methods=['POST'])
def upload_file():
    if 'file' not in request.files:
        return 'No file part', 400

    file = request.files['file']
    if file.filename == '':
        return 'No selected file', 400

    file_path = os.path.join(app.config['UPLOAD_FOLDER'], file.filename)
    file.save(file_path)

    file_names = []
    if file.filename.endswith('.kml'):
        file_names = process_kml(file_path)
    elif file.filename.endswith('.xlsx'):
        process_xlsx(file_path)

    # Pass the file_names to the template
    return render_template('converter.html', file_names=file_names)

@app.route('/import', methods=['POST'])
def import_file():
    if 'file' not in request.files:
        return 'No file part', 400

    file = request.files['file']
    if file.filename == '':
        return 'No selected file', 400

    file_path = os.path.join(app.config['IMPORT_FOLDER'], file.filename)
    file.save(file_path)

    file_names = []
    if file.filename.endswith('.json'):
        file_names = process_json(file_path)
    else:
        return 'Invalid file type', 400

    # Add a success message
    success_message = f"File '{file.filename}' has been successfully imported."

    # Pass the file_names to the template
    return render_template('export.html', file_names=file_names, success_message=success_message)

# Route to delete a specific file
@app.route('/saved_routes/<filename>', methods=['DELETE'])
def delete_file(filename):
    directory = './saved_routes'  # Replace with your directory
    file_path = os.path.join(directory, filename)
    try:
        if os.path.exists(file_path):
            os.remove(file_path)
            return jsonify({"message": f"File {filename} deleted successfully."}), 200
        else:
            return jsonify({"error": "File not found."}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/saved_routes/<path:filename>', methods=['POST'])
def update_saved_route(filename):
    folder_path = os.path.join(os.getcwd(), 'saved_routes')
    file_path = os.path.join(folder_path, filename)

    # Check if the file exists
    if not os.path.exists(file_path):
        return jsonify(error="File not found"), 404

    # Get the updated content from the request body
    updated_content = request.get_json()
    if updated_content is None:
        return jsonify(error="Invalid JSON data"), 400

    try:
        # Write the updated content back to the file
        with open(file_path, 'w') as f:
            f.write(json.dumps(updated_content, indent=4))

        return jsonify(message="File updated successfully"), 200
    except Exception as e:
        return jsonify(error=str(e)), 500


if __name__ == '__main__':
    app.run(debug=True)
