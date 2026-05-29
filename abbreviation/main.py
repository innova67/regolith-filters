from pathlib import Path
import os
import re
import shutil
import json
import sys

"""
Regolith filter to reduce JSON behavior filenames.

This filter follows these rules:
1. Do not touch any folder name, only .json filenames
2. Reduce the name to at most 5 letters
3. Follow a semantic strategy of picking relevant letters
4. Discard all ".behavior" naming
5. Ignore manifest.json and specified directories
"""

def reduce_name(filename: str) -> str:
    """
    Reduces a behavior JSON filename to at most 5 letters following semantic rules.
    
    Rules:
    1. Remove all suffixes before processing (like .behavior, .animation, etc.)
    2. For compound words (with _ or -), take first letter of each word
    3. For single words, take first, middle and last letter
    4. Limit to 5 letters maximum
    5. Keep the .json extension
    """
    # Remove .json extension
    base_name = filename.removesuffix('.json')
    
    # Remove any suffixes (parts after the last dot but before .json)
    if '.' in base_name:
        base_name = base_name.split('.')[0]
    
    # Check if the name has separators (underscore or hyphen)
    if '_' in base_name or '-' in base_name:
        # Split by underscore or hyphen
        parts = re.split(r'[_\-]', base_name)
        # Take first letter of each part
        reduced = ''.join(part[0] for part in parts if part)
    else:
        # For a single word, take first, possibly middle, and last letter
        if len(base_name) <= 3:
            reduced = base_name  # Too short to reduce
        else:
            # Take first, middle and last letter
            middle_idx = len(base_name) // 2
            reduced = base_name[0] + base_name[middle_idx] + base_name[-1]
    
    # Limit to 5 letters
    reduced = reduced[:5]
    
    # Add back the .json extension
    return reduced + '.json'

def process_directory(directory: Path, ignored_dirs=None):
    """
    Process all JSON files in the given directory.
    Only modifies filenames, not directory names.
    Ignores specified directories and manifest.json files.
    Prevents filename collisions by adding numbers when necessary.
    """
    if ignored_dirs is None:
        ignored_dirs = []
    
    # Debug: Print the current directory being processed
    print(f"Processing directory: {directory}")
    
    # Check if the directory or its parents should be ignored
    for ignored_dir in ignored_dirs:
        if ignored_dir in str(directory):
            print(f"Skipping ignored directory: {directory}")
            return
    
    # Get all JSON files in the directory
    json_files = list(directory.glob('*.json'))
    print(f"Found {len(json_files)} JSON files in {directory}")
    
    # Keep track of used names in this directory
    used_names = set()
    
    # Process JSON files
    for json_file in json_files:
        # Skip if not a file
        if not json_file.is_file():
            continue
        
        # Debug: Print the file being examined
        print(f"Examining file: {json_file}")
        
        # Skip manifest.json files
        if json_file.name.lower() == "manifest.json":
            print(f"Skipping manifest file: {json_file}")
            continue
        
        # Get the basic new name
        basic_new_name = reduce_name(json_file.name)
        
        # Handle filename collisions
        new_name = basic_new_name
        name_base = basic_new_name[:-5]  # Remove .json
        counter = 0
        
        # If the name is already used, add a number
        while new_name.lower() in used_names:
            counter += 1
            new_name = f"{name_base}{counter}.json"
            print(f"ERR: Name collision, adding number: {counter}")
        
        # Add to used names
        used_names.add(new_name.lower())
        
        # Create the new path
        new_path = json_file.parent / new_name
        
        # Rename the file
        print(f"Renaming: {json_file.name} -> {new_name}")
        shutil.move(str(json_file), str(new_path))
    
    # Process subdirectories
    for subdir in directory.iterdir():
        if subdir.is_dir():
            process_directory(subdir, ignored_dirs)

def process_directory_with_file_ignore(directory: Path, ignored_dirs=None, ignored_files=None):
    """
    Process all JSON files in the given directory with additional file-name based ignoring.
    Only modifies filenames, not directory names.
    Ignores specified directories and specified files by name.
    Prevents filename collisions by adding numbers when necessary.
    """
    if ignored_dirs is None:
        ignored_dirs = []
    
    if ignored_files is None:
        ignored_files = []
    
    # Debug: Print the current directory being processed
    print(f"Processing directory with file ignore: {directory}")
    
    # Check if the directory or its parents should be ignored
    for ignored_dir in ignored_dirs:
        if ignored_dir in str(directory):
            print(f"Skipping ignored directory: {directory}")
            return
    
    # Get all JSON files in the directory
    json_files = list(directory.glob('*.json'))
    print(f"Found {len(json_files)} JSON files in {directory}")
    
    # Keep track of used names in this directory
    used_names = set()
    
    # Process JSON files
    for json_file in json_files:
        # Skip if not a file
        if not json_file.is_file():
            continue
        
        # Debug: Print the file being examined
        # print(f"DEBUG: Examining file: {json_file}")
        
        # Skip files in the ignored list
        if json_file.name.lower() in [f.lower() for f in ignored_files]:
            print(f"Skipping ignored file: {json_file}")
            continue
        
        # Get the basic new name
        basic_new_name = reduce_name(json_file.name)
        
        # Handle filename collisions
        new_name = basic_new_name
        name_base = basic_new_name[:-5]  # Remove .json
        counter = 0
        
        # If the name is already used, add a number
        while new_name.lower() in used_names:
            counter += 1
            new_name = f"{name_base}{counter}.json"
            print(f"ERR: Name collision, adding number: {counter}")
        
        # Add to used names
        used_names.add(new_name.lower())
        
        # Create the new path
        new_path = json_file.parent / new_name
        
        # Rename the file
        print(f"Renaming: {json_file.name} -> {new_name}")
        shutil.move(str(json_file), str(new_path))
    
    # Process subdirectories
    for subdir in directory.iterdir():
        if subdir.is_dir():
            process_directory_with_file_ignore(subdir, ignored_dirs, ignored_files)

def run(context=None):
    """
    Entry point for the Regolith filter.
    
    Regolith executes filters in a temporary directory with the structure:
    ./BP/ - Behavior pack files
    ./RP/ - Resource pack files
    ./data/ - Data files
    """
    # Debug: Print current working directory
    cwd = os.getcwd()
    print(f"Current working directory: {cwd}")
    # print(f"DEBUG: Directory contents: {os.listdir(cwd)}")
    
    # Process BP directory
    bp_dir = Path("./BP")
    if bp_dir.exists():
        print(f"BP directory exists at {bp_dir.absolute()}")
        # print(f"DEBUG: BP directory contents: {list(bp_dir.iterdir())}")
        
        # Define directories to ignore in BP
        bp_ignored_dirs = [
            "loot_tables",
            "trading",
            "scripts",
            "structures",
            "texts",
            "feature_rules",
            "features",
            "biomes",
            "functions",
            "item_catalog",
        ]
        
        # Check for behavior directory
        behavior_dir = bp_dir / "behavior"
        if behavior_dir.exists() and behavior_dir.is_dir():
            print(f"Processing behavior files in: {behavior_dir}")
            # print(f"DEBUG: Behavior directory contents: {list(behavior_dir.iterdir())}")
            process_directory(behavior_dir, bp_ignored_dirs)
        else:
            print(f"No behavior directory found in {bp_dir}")
            # Debug: Try processing the BP directory directly
            print(f"Trying to process BP directory directly")
            process_directory(bp_dir, bp_ignored_dirs)
    else:
        print(f"BP directory not found")
    
    # Process RP directory
    rp_dir = Path("./RP")
    if rp_dir.exists():
        print(f"RP directory exists at {rp_dir.absolute()}")
        # print(f"DEBUG: RP directory contents: {list(rp_dir.iterdir())}")
        
        # Define directories to ignore in RP
        rp_ignored_dirs = [
            "textures",
            "texts",
            "sounds",
            "particles"
        ]
        
        # Define files to ignore in RP
        rp_ignored_files = [
            "manifest.json",
            "sounds.json",
            "blocks.json",
            "biomes_client.json",
            "_ui_defs.json",
            "music_definitions.json",
        ]
        
        # Process RP directory
        print(f"Processing resource pack files in: {rp_dir}")
        process_directory_with_file_ignore(rp_dir, rp_ignored_dirs, rp_ignored_files)
    else:
        print(f"RP directory not found")

# The filter can be run directly for testing
if __name__ == "__main__":
    run()