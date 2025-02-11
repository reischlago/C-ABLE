import pandas as pd
import xml.etree.ElementTree as ET
import json
from haversine import haversine, Unit
import chardet


def get_content(file_path):
    """
    get_content reads the content of the file that was uploaded and returns
    it as a string, having removed the colons.
    """
    with open(file_path, 'rb') as file:
        content = file.read()

        result = chardet.detect(content)
        encoding = result['encoding']

        try:
            content = content.decode(encoding)
        except UnicodeDecodeError:
            content = content.decode(encoding, errors='ignore')

    # Replace occurrences of colons with underscores.
    content = content.replace(':', '_')

    return content


def make_tree(content):
    """
    make_tree takes the content of the file and returns an ElementTree object.
    """
    tree = ET.ElementTree(ET.fromstring(content))
    root = tree.getroot()

    return root


def collect_placemarks(root):
    """
    collect_placemarks takes the root of the ElementTree object and returns
    a list of all the Placemark elements. These are routes if they contain a
    LineString element, otherwise they are nodes.
    """
    namespace = ""
    if root.tag.startswith("{"):
        namespace = root.tag.split("}")[0].strip("{")

    namespaces = {'ns': namespace} if namespace else {}

    return root.findall(".//ns:Placemark", namespaces), namespaces


def split_placemarks(placemarks, namespaces):
    """
    split_placemarks takes a list of Placemark elements and returns two lists:
    one containing the nodes and the other containing the routes.
    """
    nodes = []
    routes = []

    for placemark in placemarks:
        if placemark.find(".//ns:LineString", namespaces):
            routes.append(placemark)
        else:
            nodes.append(placemark)

    return nodes, routes


def process_nodes(nodes, namespaces):
    """
    process_nodes takes a list of nodes and returns a dictionary where the keys
    are the coordinates of the nodes and the values are the names of the nodes.
    """
    node_dict = {}

    for node in nodes:
        name = node.find(".//ns:name", namespaces).text
        coords = ','.join(node.find(".//ns:coordinates", namespaces)
                          .text.split(',')[:-1])
        node_dict[coords] = name

    return node_dict


def build_links(route, namespaces):
    """
    build_links takes a route and returns a list of links, where each link is
    a dictionary containing the start and end coordinates of the link, as well
    as the distance between them.
    """

    route_list = route.find(".//ns:LineString", namespaces) \
        .find(".//ns:coordinates", namespaces).text.split()
    route_list = [coord.split(",") for coord in route_list]
    route_list = [[float(coord) for coord in coords] for coords in route_list]

    links = []

    for i in range(len(route_list) - 1):
        start = route_list[i]
        end = route_list[i + 1]
        distance = haversine(start[:2][::-1], end[:2][::-1],
                             unit=Unit.KILOMETERS)
        links.append({"start": start, "end": end,
                      "distance": distance, "cable_type": "UNKNOWN"})

    return links


WAYPOINT_INDEX = 0


def build_nodes(links, nodes):
    """
    build_nodes takes a list of links and returns a list of nodes, where each
    node is a dictionary containing the coordinates and depth of the node.
    """
    global WAYPOINT_INDEX

    node_list = []

    for link in links:
        coords = link["start"][:2]
        depth = link["start"][2]
        node_name = f"WAYPOINT {WAYPOINT_INDEX}"
        coords_str = ','.join([str(c) for c in coords])
        if coords_str in nodes:
            node_name = nodes[coords_str]
        else:
            WAYPOINT_INDEX += 1
        node_list.append({"name": node_name, "coords": coords, "depth": depth})

    coords = links[-1]["end"][:2]
    depth = links[-1]["end"][2]
    node_name = f"WAYPOINT {WAYPOINT_INDEX}"
    coords_str = ','.join([str(c) for c in coords])
    if coords_str in nodes:
        node_name = nodes[coords_str]
    else:
        WAYPOINT_INDEX += 1
    node_list.append({"name": node_name, "coords": coords, "depth": depth})

    return node_list


def process_kml(file_path):
    file_name = file_path.split("/")[-1]
    content = get_content(file_path)
    root = make_tree(content)
    placemarks, namespaces = collect_placemarks(root)
    nodes, routes = split_placemarks(placemarks, namespaces)
    nodes = process_nodes(nodes, namespaces)

    route_names = dict()

    for route in routes:
        route_name = route.find(".//ns:name", namespaces).text
        links = build_links(route, namespaces)
        nodes = build_nodes(links, nodes)
        route_name = f"{file_name[:-4]}_{route_name}"
        route_name = route_name.replace(" ", "_")
        route_name = route_name.replace("/", "_")

        if route_name in route_names:
            old_route_name = route_name
            route_name += f"_{route_names[route_name]}"
            route_names[old_route_name] += 1

        if route_name not in route_names:
            route_names[route_name] = 2

        route_dict = {"route_name": route_name,
                      "nodes": nodes, "links": links}

        with open(f"saved_routes/{route_name}.json", "w") as file:
            json.dump(route_dict, file, indent=4)

    return list(route_names.keys())

def process_json(file_path):
    with open(file_path, 'r') as file:
        content = file.read()

    data = json.loads(content)

    route_name = data['route_name']
    nodes = data['nodes']
    links = data['links']

    with open(f"saved_routes/{route_name}.json", "w") as file:
        json.dump(data, file, indent=4)

    return [route_name]

def process_xlsx(file_path):
    df = pd.read_excel(file_path, sheet_name="RPL")
    # TODO: If needed, finish
